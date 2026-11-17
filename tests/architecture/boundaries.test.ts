import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
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
  await mkdir(join(directory, 'apps/web/src'), { recursive: true });
  await writeFile(
    join(directory, 'apps/web/tsconfig.json'),
    JSON.stringify({
      compilerOptions: { paths: { '@/*': ['./src/*'] } },
      include: ['src/**/*.ts', 'src/**/*.tsx'],
    }),
  );
  await writeFile(join(directory, 'apps/web/src/placeholder.ts'), 'export {};');
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
  ['web-no-server', 'apps/web/index.ts', '../../packages/llm/index.ts'],
  ['contracts-no-server', 'packages/contracts/index.ts', '../llm/index.ts'],
  ['ui-no-business', 'packages/ui/index.ts', '../llm/index.ts'],
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

test('server agent infrastructure can use the public LLM gateway', async () => {
  const { result } = await check(
    {
      'packages/backend/src/modules/agents/infrastructure/example.ts':
        "import '@anyko/llm';",
      'packages/llm/package.json': JSON.stringify({
        name: '@anyko/llm',
        type: 'module',
        exports: './index.ts',
      }),
      'packages/llm/index.ts': 'export const gateway = 1;',
      'apps/placeholder.ts': 'export {};',
    },
    false,
    ['llm'],
  );
  expect(result.summary.advisedExitCode).toBe(0);
});

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

// Backend (ADR 0009): правила этапа 1. Каждое правило имеет пример нарушения и пример разрешённого кода.

function npmModule(name: string): Record<string, string> {
  return {
    [`node_modules/${name}/package.json`]: JSON.stringify({
      name,
      main: 'index.js',
    }),
    [`node_modules/${name}/index.js`]: 'module.exports = {};',
  };
}

function hasViolation(
  result: { summary: { violations: { rule: { name: string } }[] } },
  rule: string,
) {
  return result.summary.violations.some((item) => item.rule.name === rule);
}

test('backend-no-contracts rejects new HTTP contract imports and permits the listed legacy file', async () => {
  const contractImport = "import '../../../../contracts/index.ts';";
  const contractTarget = 'packages/contracts/index.ts';
  const rejected = await check({
    'packages/backend/src/modules/works/new-rule.ts': contractImport,
    [contractTarget]: 'export const value = 1;',
    'apps/placeholder.ts': 'export {};',
  });
  expect(hasViolation(rejected.result, 'backend-no-contracts')).toBe(true);
  const legacy = await check({
    'packages/backend/src/modules/works/index.ts': contractImport,
    [contractTarget]: 'export const value = 1;',
    'apps/placeholder.ts': 'export {};',
  });
  expect(hasViolation(legacy.result, 'backend-no-contracts')).toBe(false);
});

test('backend-no-transport-libs rejects Elysia, BullMQ and ioredis outside the listed runtime adapters', async () => {
  const rejected = await check({
    'packages/backend/src/modules/works/infrastructure/queue.ts':
      "import 'bullmq';",
    ...npmModule('bullmq'),
    'apps/placeholder.ts': 'export {};',
  });
  expect(hasViolation(rejected.result, 'backend-no-transport-libs')).toBe(true);
  const allowed = await check({
    'apps/worker/src/queues/index.ts': "import 'bullmq';",
    'packages/backend/src/runtime/works/worker.ts': "import 'bullmq';",
    ...npmModule('bullmq'),
  });
  expect(hasViolation(allowed.result, 'backend-no-transport-libs')).toBe(false);
});

test('backend-contracts-only-zod permits zod and rejects other external or Node dependencies', async () => {
  const allowed = await check({
    'packages/contracts/index.ts': "import 'zod';",
    ...npmModule('zod'),
    'apps/placeholder.ts': 'export {};',
  });
  expect(hasViolation(allowed.result, 'backend-contracts-only-zod')).toBe(
    false,
  );
  for (const dependency of ['example-external', 'node:fs']) {
    const rejected = await check({
      'packages/contracts/index.ts': `import '${dependency}';`,
      ...npmModule('example-external'),
      'apps/placeholder.ts': 'export {};',
    });
    expect(hasViolation(rejected.result, 'backend-contracts-only-zod')).toBe(
      true,
    );
  }
});

test('backend-scope-issued-by-access rejects scope issuance outside access and permits access', async () => {
  const issuer = 'packages/backend/src/platform/scope/issue.ts';
  const issuerSource = 'export const issueWorkspaceScope = () => 1;';
  const rejected = await check({
    [issuer]: issuerSource,
    'packages/backend/src/modules/works/application/example.ts':
      "import { issueWorkspaceScope } from '../../../platform/scope/issue.ts';\nexport const scope = issueWorkspaceScope;",
    'apps/placeholder.ts': 'export {};',
  });
  expect(hasViolation(rejected.result, 'backend-scope-issued-by-access')).toBe(
    true,
  );
  const allowed = await check({
    [issuer]: issuerSource,
    'packages/backend/src/modules/access/infrastructure/example.ts':
      "import { issueWorkspaceScope } from '../../../platform/scope/issue.ts';\nexport const scope = issueWorkspaceScope;",
    'apps/placeholder.ts': 'export {};',
  });
  expect(hasViolation(allowed.result, 'backend-scope-issued-by-access')).toBe(
    false,
  );
});

test('ESLint rejects request body parsing in HTTP routes and permits passed-in values', async () => {
  const filename = 'apps/api/src/http/routes/example.js';
  const rejected = await lintSnippet(
    filename,
    'export async function handle(request) { return request.json(); }',
  );
  expect(rejected.rules).toContain('no-restricted-syntax');
  const allowed = await lintSnippet(
    filename,
    'export function handle(value) { return value; }',
  );
  expect(allowed.rules).not.toContain('no-restricted-syntax');
}, 30000);

test('ESLint rejects ambient clock, ids and environment in application code', async () => {
  const filename = 'packages/backend/src/modules/facts/application/example.js';
  const rejected = await Promise.all(
    [
      'new Date()',
      'Date.now()',
      'crypto.randomUUID()',
      'process.env.SECRET',
    ].map((code) => lintSnippet(filename, code)),
  );
  for (const result of rejected)
    expect(result.rules).toContain('no-restricted-syntax');
  const allowed = await lintSnippet(
    filename,
    'function expiresAt(now, ms) { return new Date(now.getTime() + ms); } expiresAt(new Date(0), 1);',
  );
  expect(allowed.rules).not.toContain('no-restricted-syntax');
}, 120000);

test('backend-modules-database-types-only rejects database client values outside runtime and permits types', async () => {
  const database = {
    'packages/database/package.json': JSON.stringify({
      name: '@anyko/database',
      exports: { '.': './src/index.ts' },
    }),
    'packages/database/src/index.ts':
      'export const createDatabase = (url: string) => url; export type Database = string;',
  };
  const rejected = await check(
    {
      ...database,
      'packages/backend/src/modules/access/infrastructure/example.ts':
        "import { createDatabase } from '@anyko/database';\nexport const client = createDatabase;",
      'apps/placeholder.ts': 'export {};',
    },
    false,
    ['database'],
  );
  expect(
    hasViolation(rejected.result, 'backend-modules-database-types-only'),
  ).toBe(true);
  const allowed = await check(
    {
      ...database,
      'packages/backend/src/modules/access/infrastructure/example.ts':
        "import type { Database } from '@anyko/database';\nexport type Client = Database;",
      'packages/backend/src/runtime/example.ts':
        "import { createDatabase } from '@anyko/database';\nexport const client = createDatabase;",
      'apps/placeholder.ts': 'export {};',
    },
    false,
    ['database'],
  );
  expect(
    hasViolation(allowed.result, 'backend-modules-database-types-only'),
  ).toBe(false);
}, 30000);

test('ESLint rejects process.env in backend runtime and permits passed-in configuration', async () => {
  const filename = 'packages/backend/src/runtime/example.js';
  const rejected = await lintSnippet(
    filename,
    'export const url = process.env.DATABASE_URL;',
  );
  expect(rejected.rules).toContain('no-restricted-syntax');
  const allowed = await lintSnippet(
    filename,
    'export function url(config) { return config.database.url; }',
  );
  expect(allowed.rules).not.toContain('no-restricted-syntax');
}, 60000);
// Web (apps/web): границы features/components/lib, server-only, административные контракты и правила ESLint.
// Каждый плохой пример должен отклоняться именно этим правилом; хороший проходит.
async function webRules(
  files: Record<string, string>,
  workspaceLinks: string[] = [],
) {
  const { result } = await check(files, false, workspaceLinks);
  return result.summary.violations.map((violation) => violation.rule.name);
}

test('web feature public API rejects deep cross-feature imports, including the @ alias and app/', async () => {
  const target = 'apps/web/src/features/documents/document-viewer.tsx';
  for (const [source, specifier] of [
    [
      'apps/web/src/features/works/a.ts',
      '@/features/documents/document-viewer',
    ],
    ['apps/web/src/features/works/a.ts', '../documents/document-viewer'],
    ['apps/web/src/app/other.tsx', '@/features/documents/document-viewer'],
  ] as const) {
    const rules = await webRules({
      [source]: `import '${specifier}';`,
      [target]: 'export const value = 1;',
    });
    expect(rules).toContain('web-feature-public-api');
  }
});

test('web feature public API permits the public index and the own feature', async () => {
  const rules = await webRules({
    'apps/web/src/features/works/a.ts':
      "import '@/features/documents';\nimport './b';",
    'apps/web/src/features/works/b.ts': 'export const value = 1;',
    'apps/web/src/features/documents/index.ts': 'export const value = 1;',
  });
  expect(rules).toHaveLength(0);
});

test('web features cannot form cycles', async () => {
  const rules = await webRules({
    'apps/web/src/features/a/index.ts': "import './x';",
    'apps/web/src/features/a/x.ts': "import '@/features/b';",
    'apps/web/src/features/b/index.ts': "import '@/features/a';",
  });
  expect(rules).toContain('web-no-feature-cycles');
  const acyclic = await webRules({
    'apps/web/src/features/a/index.ts': "import '@/features/b';",
    'apps/web/src/features/b/index.ts': 'export const value = 1;',
  });
  expect(acyclic).toHaveLength(0);
});

test('web features and components cannot import app routes', async () => {
  for (const source of [
    'apps/web/src/features/works/a.ts',
    'apps/web/src/components/ui/a.ts',
  ]) {
    const rules = await webRules({
      [source]: "import '@/app/other';",
      'apps/web/src/app/other.ts': 'export const value = 1;',
    });
    expect(rules).toContain('web-features-no-app');
  }
  const allowed = await webRules({
    'apps/web/src/features/works/a.ts': "import '@/components/ui/b';",
    'apps/web/src/components/ui/b.ts': 'export const value = 1;',
  });
  expect(allowed).toHaveLength(0);
});

test('web components cannot import features or the API client', async () => {
  for (const [specifier, target] of [
    ['@/features/documents', 'apps/web/src/features/documents/index.ts'],
    ['@/lib/api/client', 'apps/web/src/lib/api/client.ts'],
  ] as const) {
    const rules = await webRules({
      'apps/web/src/components/ui/a.ts': `import '${specifier}';`,
      [target]: 'export const value = 1;',
    });
    expect(rules).toContain('web-components-no-features');
  }
  const allowed = await webRules({
    'apps/web/src/components/ui/a.ts': "import '@/components/ui/b';",
    'apps/web/src/components/ui/b.ts': 'export const value = 1;',
  });
  expect(allowed).toHaveLength(0);
});

test('web API client is imported only from feature api folders and lib', async () => {
  const client = {
    'apps/web/src/lib/api/client.ts': 'export const requestApi = 1;',
  };
  const rules = await webRules({
    ...client,
    'apps/web/src/features/works/new-screen.tsx': "import '@/lib/api/client';",
  });
  expect(rules).toContain('web-api-client-in-api');
  for (const source of [
    'apps/web/src/features/works/api/queries.ts',
    'apps/web/src/lib/api/extra.ts',
    'apps/web/src/features/works/queries.test.ts',
  ]) {
    const allowed = await webRules({
      ...client,
      [source]: "import '@/lib/api/client';",
    });
    expect(allowed).toHaveLength(0);
  }
});

test('web features and components cannot import server-only modules', async () => {
  const server = {
    'apps/web/src/lib/server/config.ts': 'export const value = 1;',
  };
  for (const source of [
    'apps/web/src/features/works/a.ts',
    'apps/web/src/components/ui/a.ts',
  ]) {
    const rules = await webRules({
      ...server,
      [source]: "import '@/lib/server/config';",
    });
    expect(rules).toContain('web-server-only');
  }
  const allowed = await webRules({
    ...server,
    'apps/web/src/app/route.ts': "import '@/lib/server/config';",
  });
  expect(allowed).toHaveLength(0);
});

test('web cannot import administrative contracts but can import resource contracts', async () => {
  const contracts = {
    'packages/contracts/package.json': JSON.stringify({
      name: '@anyko/contracts',
      exports: {
        './admin': './src/admin/index.ts',
        './works': './src/works.ts',
      },
    }),
    'packages/contracts/src/admin/index.ts': 'export const value = 1;',
    'packages/contracts/src/works.ts': 'export const value = 1;',
  };
  const rules = await webRules(
    {
      ...contracts,
      'apps/web/src/features/works/a.ts': "import '@anyko/contracts/admin';",
    },
    ['contracts'],
  );
  expect(rules).toContain('web-no-contracts-admin');
  const allowed = await webRules(
    {
      ...contracts,
      'apps/web/src/features/works/a.ts': "import '@anyko/contracts/works';",
    },
    ['contracts'],
  );
  expect(allowed).toHaveLength(0);
});

test('web imports contract resources by subpath and rejects the contracts root', async () => {
  const contracts = {
    'packages/contracts/package.json': JSON.stringify({
      name: '@anyko/contracts',
      exports: {
        '.': './src/index.ts',
        './works': './src/works.ts',
      },
    }),
    'packages/contracts/src/index.ts': 'export const value = 1;',
    'packages/contracts/src/works.ts': 'export const value = 1;',
  };
  const rules = await webRules(
    {
      ...contracts,
      'apps/web/src/features/works/a.ts': "import '@anyko/contracts';",
    },
    ['contracts'],
  );
  expect(rules).toContain('web-no-contracts-root');
  const allowed = await webRules(
    {
      ...contracts,
      'apps/web/src/features/works/a.ts': "import '@anyko/contracts/works';",
    },
    ['contracts'],
  );
  expect(allowed).toHaveLength(0);
});

// One ESLint instance checks every web example. ruleFilter keeps only the rules under test, so typed rules never
// run and projectService stays off: the real configuration (files globs and rule settings) is used without
// type information, in seconds instead of a typed run per snippet.
const checkedWebRules = [
  'no-restricted-imports',
  'no-restricted-globals',
  'no-restricted-properties',
  'react-hooks/rules-of-hooks',
  '@eslint-community/eslint-comments/require-description',
  'jsx-a11y-x/alt-text',
];

async function lintWebSnippets(
  cases: Record<string, { filename: string; code: string }>,
) {
  const script = `
import { ESLint } from 'eslint';
const cases = JSON.parse(await new Response(process.stdin).text());
const checked = ${JSON.stringify(checkedWebRules)};
const eslint = new ESLint({
  cwd: process.cwd(),
  ruleFilter: ({ ruleId }) => checked.includes(ruleId),
  overrideConfig: { languageOptions: { parserOptions: { projectService: false } } },
});
const output = {};
for (const [name, item] of Object.entries(cases)) {
  const [result] = await eslint.lintText(item.code, { filePath: item.filename });
  output[name] = result.messages.map((message) => message.ruleId);
}
console.log(JSON.stringify(output));
`;
  const subprocess = Bun.spawn(['node', '--input-type=module', '-e', script], {
    cwd: root,
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  });
  await subprocess.stdin.write(JSON.stringify(cases));
  await subprocess.stdin.end();
  const [output, errors] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
  ]);
  if (!output.trim()) throw new Error(errors);
  return JSON.parse(output) as Record<string, (string | null)[]>;
}

describe('ESLint web examples', () => {
  const feature = 'apps/web/src/features/auth/sign-in.tsx';
  const app = 'apps/web/src/app/layout.tsx';
  const runtime = 'packages/backend/src/runtime/index.ts';
  let rules: Record<string, (string | null)[]> = {};

  beforeAll(async () => {
    rules = await lintWebSnippets({
      formLibrary: {
        filename: feature,
        code: "import { useForm } from '@tanstack/react-form';",
      },
      persistedStore: {
        filename: feature,
        code: "import { persist } from 'zustand/middleware';",
      },
      memoryStore: {
        filename: feature,
        code: "import { create } from 'zustand';",
      },
      persistOutsideFeatures: {
        filename: app,
        code: "import { persist } from 'zustand/middleware';",
      },
      localStorageInFeature: {
        filename: feature,
        code: "localStorage.setItem('draft', 'x');",
      },
      sessionStorageOnWindow: {
        filename: feature,
        code: "window.sessionStorage.getItem('draft');",
      },
      conditionalHook: {
        filename: app,
        code: "import { useState } from 'react';\nexport function C(p: { on: boolean }) {\n  if (p.on) useState(0);\n  return null;\n}",
      },
      undescribedDisable: {
        filename: runtime,
        code: '// eslint-disable-next-line no-console\nexport const value = 1;',
      },
      describedDisable: {
        filename: runtime,
        code: '// eslint-disable-next-line no-console -- example reason\nexport const value = 1;',
      },
      imageWithoutAlt: {
        filename: feature,
        code: 'export const logo = <img src="x" />;',
      },
      imageWithAlt: {
        filename: feature,
        code: 'export const logo = <img src="x" alt="Логотип" />;',
      },
    });
  }, 120000);

  test('ESLint blocks TanStack Form and persisted Zustand inside web features only', () => {
    expect(rules.formLibrary).toContain('no-restricted-imports');
    expect(rules.persistedStore).toContain('no-restricted-imports');
    expect(rules.memoryStore).not.toContain('no-restricted-imports');
    expect(rules.persistOutsideFeatures).not.toContain('no-restricted-imports');
  });

  test('ESLint blocks browser storage in web features', () => {
    expect(rules.localStorageInFeature).toContain('no-restricted-globals');
    expect(rules.sessionStorageOnWindow).toContain('no-restricted-properties');
  });

  test('ESLint applies react-hooks to web files and requires eslint-disable reasons', () => {
    expect(rules.conditionalHook).toContain('react-hooks/rules-of-hooks');
    expect(rules.undescribedDisable).toContain(
      '@eslint-community/eslint-comments/require-description',
    );
    expect(rules.describedDisable).not.toContain(
      '@eslint-community/eslint-comments/require-description',
    );
  });

  test('ESLint requires alt text on images in web files', () => {
    expect(rules.imageWithoutAlt).toContain('jsx-a11y-x/alt-text');
    expect(rules.imageWithAlt).not.toContain('jsx-a11y-x/alt-text');
  });
});
