import { afterAll, expect, test } from 'bun:test';
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
  symlink,
} from 'node:fs/promises';
import { dirname, join, posix, resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');
const cli = join(
  root,
  'node_modules/dependency-cruiser/bin/dependency-cruiser.mjs',
);
const config = join(root, '.dependency-cruiser.cjs');
await mkdir(join(root, 'work'), { recursive: true });
const temporary = await mkdtemp(join(root, 'work', 'architecture-'));
let count = 0;

afterAll(async () => {
  await rm(temporary, { recursive: true, force: true });
});

async function check(
  files: Record<string, string>,
  withAllowedEdge = false,
  workspaceLinks: string[] = [],
) {
  const directory = join(temporary, String(count++));
  await Promise.all(
    ['apps', 'packages'].map((folder) =>
      mkdir(join(directory, folder), { recursive: true }),
    ),
  );
  let fixtureConfig = config;
  if (withAllowedEdge) {
    const original = await readFile(config, 'utf8');
    const modified = original.replace('facts: [],', "facts: ['cases'],");
    if (modified === original)
      throw new Error('Could not configure fixture edge');
    await mkdir(directory, { recursive: true });
    fixtureConfig = join(directory, 'dependency-cruiser.cjs');
    await writeFile(fixtureConfig, modified);
  }
  for (const [path, content] of Object.entries(files)) {
    const destination = join(directory, path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, content);
  }
  for (const workspace of workspaceLinks) {
    const link = join(directory, 'node_modules/@anyko', workspace);
    await mkdir(dirname(link), { recursive: true });
    await symlink(
      join(directory, 'packages', workspace),
      link,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
  }
  const subprocess = Bun.spawn(
    [
      'node',
      cli,
      '--config',
      fixtureConfig,
      '--output-type',
      'json',
      'apps',
      'packages',
    ],
    {
      cwd: directory,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
    subprocess.exited,
  ]);
  if (!stdout.trim()) throw new Error(`dependency-cruiser failed: ${stderr}`);
  const result: unknown = JSON.parse(stdout);
  if (typeof result !== 'object' || result === null || !('summary' in result)) {
    throw new Error(`Unexpected dependency-cruiser result: ${stdout}`);
  }
  return {
    result: result as {
      summary: {
        advisedExitCode: number;
        violations: { rule: { name: string } }[];
      };
    },
    exitCode,
  };
}

const cases = [
  ['web-no-server', 'apps/web/index.ts', '../../packages/backend/index.ts'],
  [
    'contracts-no-server',
    'packages/contracts/index.ts',
    '../database/index.ts',
  ],
  ['ui-no-business', 'packages/ui/index.ts', '../contracts/index.ts'],
  [
    'modules-no-workflows',
    'packages/backend/src/modules/facts/index.ts',
    '../../workflows/index.ts',
  ],
  ['database-private', 'apps/api/index.ts', '../../packages/database/index.ts'],
  [
    'profiles-no-io',
    'packages/backend/src/profiles/bfl/index.ts',
    '../../runtime/index.ts',
  ],
  [
    'platform-no-business',
    'packages/backend/src/platform/index.ts',
    '../modules/facts/index.ts',
  ],
  [
    'domain-no-infrastructure',
    'packages/backend/src/modules/facts/domain/index.ts',
    '../infrastructure/index.ts',
  ],
] as const;

for (const [rule, source, target] of cases) {
  test(`rejects ${rule}`, async () => {
    const targetPath = posix
      .resolve('/', posix.dirname(source), target)
      .slice(1);
    const { result } = await check({
      [source]: `import '${target}';`,
      [targetPath]: 'export const value = 1;',
      'apps/placeholder.ts': 'export {};',
      'packages/placeholder.ts': 'export {};',
    });
    expect(result.summary.advisedExitCode).not.toBe(0);
    expect(
      result.summary.violations.some(
        (violation) => violation.rule.name === rule,
      ),
    ).toBe(true);
  });
}

test('permits a local dependency', async () => {
  const { result, exitCode } = await check({
    'apps/api/index.ts': "import './local';",
    'apps/api/local.ts': 'export const value = 1;',
    'packages/placeholder.ts': 'export {};',
  });
  expect(exitCode).toBe(0);
  expect(result.summary.violations).toHaveLength(0);
});

test('rejects dependency cycles', async () => {
  const { result } = await check({
    'apps/api/a.ts': "import './b';",
    'apps/api/b.ts': "import './a';",
    'packages/placeholder.ts': 'export {};',
  });
  expect(result.summary.advisedExitCode).not.toBe(0);
  expect(
    result.summary.violations.some(
      (violation) => violation.rule.name === 'no-cycles',
    ),
  ).toBe(true);
});

for (const [rule, source] of [
  ['domain-no-external', 'packages/backend/src/modules/facts/domain/index.ts'],
  ['profiles-no-builtins', 'packages/backend/src/profiles/bfl/index.ts'],
] as const) {
  test(`rejects Node builtins for ${rule}`, async () => {
    const { result } = await check({
      [source]: "import 'node:fs';",
      'apps/placeholder.ts': 'export {};',
    });
    expect(result.summary.advisedExitCode).not.toBe(0);
    expect(
      result.summary.violations.some(
        (violation) => violation.rule.name === rule,
      ),
    ).toBe(true);
  });
}

test('rejects npm dependencies in domain', async () => {
  const { result } = await check({
    'packages/backend/src/modules/facts/domain/index.ts':
      "import 'example-external';",
    'package.json': '{"dependencies":{"example-external":"1.0.0"}}',
    'node_modules/example-external/package.json':
      '{"name":"example-external","main":"index.js"}',
    'node_modules/example-external/index.js': 'module.exports = {};',
    'apps/placeholder.ts': 'export {};',
  });
  expect(result.summary.advisedExitCode).not.toBe(0);
  expect(
    result.summary.violations.some(
      (violation) => violation.rule.name === 'domain-no-external',
    ),
  ).toBe(true);
});

test('profiles allow Zod schemas but reject other npm dependencies', async () => {
  for (const dependency of ['zod', 'example-external']) {
    const { result } = await check({
      'packages/backend/src/profiles/bfl/index.ts': `import '${dependency}';`,
      'package.json': JSON.stringify({
        dependencies: { [dependency]: '1.0.0' },
      }),
      [`node_modules/${dependency}/package.json`]: JSON.stringify({
        name: dependency,
        main: 'index.js',
      }),
      [`node_modules/${dependency}/index.js`]: 'module.exports = {};',
      'apps/placeholder.ts': 'export {};',
    });
    const rejected = result.summary.violations.some(
      (violation) => violation.rule.name === 'profiles-no-external-except-zod',
    );
    expect(rejected).toBe(dependency !== 'zod');
  }
});

test('blocks a private module import and an unapproved public module edge', async () => {
  for (const [target, expected] of [
    ['../cases/domain/secret.ts', 'module-private-import-cases'],
    ['../cases/index.ts', 'module-allowlist-facts'],
  ] as const) {
    const { result } = await check({
      'packages/backend/src/modules/facts/index.ts': `import '${target}';`,
      [`packages/backend/src/modules/cases/${target.endsWith('index.ts') ? 'index.ts' : 'domain/secret.ts'}`]:
        'export {};',
      'apps/placeholder.ts': 'export {};',
    });
    expect(
      result.summary.violations.some((item) => item.rule.name === expected),
    ).toBe(true);
  }
});

test('composition root may bind module adapters while application internals stay private', async () => {
  for (const [target, forbidden] of [
    ['infrastructure/store.ts', false],
    ['application/command.ts', true],
  ] as const) {
    const { result } = await check({
      'apps/placeholder.ts': 'export {};',
      'packages/backend/src/runtime/index.ts': `import '../modules/documents/${target}';`,
      [`packages/backend/src/modules/documents/${target}`]: 'export {};',
    });
    expect(
      result.summary.violations.some(
        (v) => v.rule.name === 'runtime-only-module-adapters',
      ),
    ).toBe(forbidden);
    if (!forbidden) expect(result.summary.violations).toHaveLength(0);
  }
});

test('runtime imports are restricted to named process composition and diagnostic CLI', async () => {
  for (const [file, forbidden] of [
    ['api/src/bootstrap/start-api.ts', false],
    ['worker/src/bootstrap/start-worker.ts', false],
    ['worker/src/cli/diagnostic.ts', false],
    ['api/src/bootstrap/config.ts', true],
    ['api/src/http/routes/documents.ts', true],
  ] as const) {
    const source = `apps/${file}`;
    const target = posix.relative(
      posix.dirname(source),
      'packages/backend/src/runtime/index.ts',
    );
    const { result } = await check({
      [source]: `import '${target}';`,
      'packages/backend/src/runtime/index.ts': 'export {};',
    });
    expect(
      result.summary.violations.some(
        (v) => v.rule.name === 'app-runtime-only-bootstrap',
      ),
    ).toBe(forbidden);
  }
});

test('integration tests may bind real adapters but cannot import private application rules', async () => {
  for (const [target, forbidden] of [
    ['infrastructure/store.ts', false],
    ['application/private.ts', true],
  ] as const) {
    const { result } = await check({
      'packages/backend/tests/integration/fixture.test.ts': `import '../../src/modules/documents/${target}';`,
      [`packages/backend/src/modules/documents/${target}`]: 'export {};',
    });
    expect(
      result.summary.violations.some(
        (v) => v.rule.name === 'integration-only-module-adapters',
      ),
    ).toBe(forbidden);
  }
});

test('resolves workspace exports before checking app and database restrictions', async () => {
  for (const [source, dependency, rule, forbidden] of [
    [
      'apps/api/src/bootstrap/start-api.ts',
      '@anyko/backend/runtime',
      'app-runtime-only-bootstrap',
      false,
    ],
    [
      'apps/api/src/http/routes/documents.ts',
      '@anyko/backend/runtime',
      'app-runtime-only-bootstrap',
      true,
    ],
    ['apps/web/src/page.ts', '@anyko/backend/runtime', 'web-no-server', true],
    [
      'packages/backend/tests/integration/fixture.test.ts',
      '@anyko/database',
      'database-private',
      false,
    ],
    [
      'apps/api/src/http/routes/documents.ts',
      '@anyko/database',
      'database-private',
      true,
    ],
  ] as const) {
    const { result } = await check(
      {
        [source]: `import '${dependency}';`,
        'packages/backend/package.json': JSON.stringify({
          name: '@anyko/backend',
          exports: { './runtime': './src/runtime/index.ts' },
        }),
        'packages/backend/src/runtime/index.ts': 'export {};',
        'packages/database/package.json': JSON.stringify({
          name: '@anyko/database',
          exports: { '.': './src/index.ts' },
        }),
        'packages/database/src/index.ts': 'export {};',
      },
      false,
      ['backend', 'database'],
    );
    expect(
      result.summary.violations.some(
        (v) => v.rule.name === 'workspace-imports-must-resolve',
      ),
    ).toBe(false);
    expect(result.summary.violations.some((v) => v.rule.name === rule)).toBe(
      forbidden,
    );
  }
  const missing = await check({
    'apps/api/src/bootstrap/start-api.ts': "import '@anyko/missing';",
  });
  expect(
    missing.result.summary.violations.some(
      (v) => v.rule.name === 'workspace-imports-must-resolve',
    ),
  ).toBe(true);
}, 30000);

test('allows an owner to use its own private implementation', async () => {
  const { result } = await check({
    'packages/backend/src/modules/facts/index.ts':
      "import './domain/inner.ts';",
    'packages/backend/src/modules/facts/domain/inner.ts': 'export {};',
    'apps/placeholder.ts': 'export {};',
  });
  expect(result.summary.violations).toHaveLength(0);
});

test('explicitly allowed module edge exposes only its public index', async () => {
  const sharedFiles = {
    'apps/placeholder.ts': 'export {};',
    'packages/backend/src/modules/cases/index.ts': 'export {};',
    'packages/backend/src/modules/cases/domain/secret.ts': 'export {};',
  };
  const allowed = await check(
    {
      ...sharedFiles,
      'packages/backend/src/modules/facts/index.ts':
        "import '../cases/index.ts';",
    },
    true,
  );
  expect(allowed.result.summary.violations).toHaveLength(0);
  const privateImport = await check(
    {
      ...sharedFiles,
      'packages/backend/src/modules/facts/index.ts':
        "import '../cases/domain/secret.ts';",
    },
    true,
  );
  expect(
    privateImport.result.summary.violations.some(
      (item) => item.rule.name === 'module-private-import-cases',
    ),
  ).toBe(true);
});

async function lintSnippet(filename: string, code: string) {
  const process = Bun.spawn(
    [
      'node',
      join(root, 'node_modules/eslint/bin/eslint.js'),
      '--stdin',
      '--stdin-filename',
      filename,
      '--format',
      'json',
    ],
    { cwd: root, stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' },
  );
  await process.stdin.write(code);
  await process.stdin.end();
  const [output, errors, status] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (!output.trim()) throw new Error(errors);
  const result = JSON.parse(output) as { messages: { ruleId: string }[] }[];
  return {
    status,
    rules: result.flatMap((item) =>
      item.messages.map((message) => message.ruleId),
    ),
  };
}

test('blocks ambient I/O in domain and permits a passed-in function', async () => {
  const filename = 'packages/backend/src/modules/facts/domain/example.js';
  for (const code of [
    'fetch("https://example.org")',
    'globalThis.fetch("https://example.org")',
    'Bun.file("secret")',
  ]) {
    const result = await lintSnippet(filename, code);
    expect(result.rules).toContain('no-restricted-globals');
  }
  const allowed = await lintSnippet(
    filename,
    'function calculate(value) { return value + 1; } calculate(1);',
  );
  expect(allowed.rules).not.toContain('no-restricted-globals');
}, 30000);

test('blocks Node global access in domain and profiles while allowing local values', async () => {
  for (const filename of [
    'packages/backend/src/modules/facts/domain/example.js',
    'packages/backend/src/profiles/bfl/example.js',
  ]) {
    for (const code of [
      'global.fetch("https://example.org")',
      'global.process.env.SECRET',
    ]) {
      expect((await lintSnippet(filename, code)).rules).toContain(
        'no-restricted-globals',
      );
    }
    expect(
      (await lintSnippet(filename, 'const value = 1; value + 1;')).rules,
    ).not.toContain('no-restricted-globals');
  }
}, 30000);

test('blocks relative and src deep workspace imports but permits package exports', async () => {
  const filename = 'apps/api/example.js';
  for (const code of [
    "import '../../packages/backend/src/private.js';",
    "export * from '@anyko/backend/src/private';",
  ]) {
    const result = await lintSnippet(filename, code);
    expect(result.rules).toContain('architecture/no-cross-package-source');
  }
  const allowed = await lintSnippet(filename, "import '@anyko/backend/facts';");
  expect(allowed.rules).not.toContain('architecture/no-cross-package-source');
}, 30000);
