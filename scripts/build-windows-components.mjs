import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error('Build these experimental components on Windows x64');
}

const output = resolve(
  process.env.ANYKO_WINDOWS_COMPONENTS_OUTPUT ?? 'work/windows-components',
);
await mkdir(output, { recursive: true });
for (const [app, entry] of [
  ['api', 'apps/api/src/index.ts'],
  ['worker', 'apps/worker/src/index.ts'],
  ['provision-access', 'scripts/provision-local.ts'],
  ['prepare-storage', 'scripts/prepare-storage.ts'],
  ['template-probe', 'packages/backend/tests/portable-template-probe.ts'],
]) {
  const build = Bun.spawn(
    [
      process.execPath,
      'build',
      '--compile',
      '--no-compile-autoload-dotenv',
      '--no-compile-autoload-bunfig',
      '--asset=packages/backend/src/modules/templates/assets',
      entry,
      '--outfile',
      resolve(output, `anyko-${app}.exe`),
    ],
    { stdout: 'inherit', stderr: 'inherit' },
  );
  if ((await build.exited) !== 0) throw new Error(`Failed to build ${app}`);
}
