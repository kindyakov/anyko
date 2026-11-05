import { afterAll, expect, test } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
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

async function check(files: Record<string, string>) {
  const directory = join(temporary, String(count++));
  for (const [path, content] of Object.entries(files)) {
    const destination = join(directory, path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, content);
  }
  const subprocess = Bun.spawn(
    [
      'node',
      cli,
      '--config',
      config,
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
