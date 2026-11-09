import {
  copyFile,
  cp,
  lstat,
  mkdir,
  readdir,
  readlink,
  realpath,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error('Windows x64 is required');
}

const source = await realpath('apps/web/.next/standalone');
const destination = resolve(
  process.env.ANYKO_WINDOWS_WEB_OUTPUT ?? 'work/windows-web',
);
const links = [];

function within(root, path) {
  const value = relative(root, path);
  return (
    value !== '' &&
    value !== '..' &&
    !value.startsWith(`..${sep}`) &&
    !isAbsolute(value)
  );
}

async function copyTree(directory) {
  const target = resolve(destination, relative(source, directory));
  await mkdir(target, { recursive: true });
  for (const entry of await readdir(directory)) {
    const path = resolve(directory, entry);
    const stat = await lstat(path);
    const output = resolve(destination, relative(source, path));
    if (stat.isSymbolicLink()) {
      const resolved = await realpath(path);
      if (!within(source, resolved) || !(await lstat(resolved)).isDirectory()) {
        throw new Error(
          `Unsupported web link: ${relative(source, path)} -> ${await readlink(path)}`,
        );
      }
      links.push({
        path: relative(source, path),
        target: relative(source, resolved),
      });
    } else if (stat.isDirectory()) {
      await copyTree(path);
    } else if (stat.isFile()) {
      await mkdir(dirname(output), { recursive: true });
      await copyFile(path, output);
    } else {
      throw new Error(`Unsupported web file: ${relative(source, path)}`);
    }
  }
}

// Refuse an existing tree: it may contain another build or user data.
await mkdir(destination);
await copyTree(source);
await cp(
  'apps/web/.next/static',
  resolve(destination, 'apps/web/.next/static'),
  { recursive: true },
);
await cp('apps/web/public', resolve(destination, 'apps/web/public'), {
  recursive: true,
});
await copyFile(process.execPath, resolve(destination, 'bun.exe'));
await copyFile(
  'scripts/restore-windows-web-links.mjs',
  resolve(destination, 'restore-windows-web-links.mjs'),
);
await writeFile(
  resolve(destination, 'junctions.json'),
  JSON.stringify(links, null, 2),
);
console.log(`Staged web files with ${links.length} junctions to restore`);
