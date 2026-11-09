import {
  copyFile,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  rmdir,
  writeFile,
} from 'node:fs/promises';
import { resolve } from 'node:path';

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error('Windows x64 is required');
}
const root = resolve('.');
const output = resolve(
  process.env.ANYKO_WINDOWS_MIGRATOR_OUTPUT ?? 'work/windows-migrator',
);
const cache = resolve(
  process.env.ANYKO_WINDOWS_BUN_CACHE ?? 'work/windows-bun-cache',
);
await mkdir(output, { recursive: true });
const stage = await mkdtemp(resolve(output, 'build-'));
for (const name of ['package.json', 'bun.lock']) {
  await copyFile(resolve(root, name), resolve(stage, name));
}
for (const group of ['apps', 'packages']) {
  for (const entry of await readdir(resolve(root, group), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) continue;
    const source = resolve(root, group, entry.name, 'package.json');
    try {
      await lstat(source);
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
    const destination = resolve(stage, group, entry.name);
    await mkdir(destination, { recursive: true });
    await copyFile(source, resolve(destination, 'package.json'));
  }
}
await cp(
  'packages/database/prisma',
  resolve(stage, 'packages/database/prisma'),
  { recursive: true },
);
await copyFile(
  'packages/database/prisma.config.ts',
  resolve(stage, 'packages/database/prisma.config.ts'),
);
const install = Bun.spawn(
  [
    process.execPath,
    'install',
    '--filter',
    '@anyko/database',
    '--frozen-lockfile',
    '--linker',
    'hoisted',
    '--cache-dir',
    cache,
  ],
  { cwd: stage, stdout: 'inherit', stderr: 'inherit' },
);
if ((await install.exited) !== 0)
  throw new Error('Migrator dependencies failed to install');
const modules = resolve(stage, 'node_modules');
async function checkModules(directory) {
  for (const name of await readdir(directory)) {
    const path = resolve(directory, name);
    const info = await lstat(path);
    if (info.isSymbolicLink()) {
      const allowed = [
        resolve(modules, '@anyko/database'),
        resolve(modules, '@anyko/typescript-config'),
      ];
      if (!allowed.includes(path))
        throw new Error(`Unexpected migrator junction: ${path}`);
      await rmdir(path);
    } else if (info.isDirectory()) {
      await checkModules(path);
    }
  }
}
await checkModules(modules);
const prismaCache = resolve(stage, 'prisma-cache');
await mkdir(prismaCache);
const prepare = Bun.spawn(
  [process.execPath, resolve(modules, 'prisma/build/index.js'), '--version'],
  {
    cwd: resolve(stage, 'packages/database'),
    env: { ...process.env, APPDATA: prismaCache, LOCALAPPDATA: prismaCache },
    stdout: 'ignore',
    stderr: 'inherit',
  },
);
if ((await prepare.exited) !== 0)
  throw new Error('Failed to prepare Prisma engine');
await lstat(resolve(modules, '@prisma/engines/schema-engine-windows.exe'));
await copyFile(process.execPath, resolve(stage, 'bun.exe'));
await writeFile(resolve(stage, 'complete.json'), JSON.stringify({ format: 2 }));
console.log(`Migrator ready: ${stage}`);
