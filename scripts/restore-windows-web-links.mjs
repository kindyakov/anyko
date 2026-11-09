import {
  lstat,
  readFile,
  readlink,
  realpath,
  rmdir,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep, win32 } from 'node:path';

const root = await realpath(process.argv[2] ?? 'work/windows-web');
const links = JSON.parse(
  await readFile(resolve(root, 'junctions.json'), 'utf8'),
);
if (!Array.isArray(links)) throw new Error('Invalid web link manifest');
const marker = resolve(root, '.junction-root');
let previousRoot;
try {
  previousRoot = await readFile(marker, 'utf8');
  if (!win32.isAbsolute(previousRoot))
    throw new Error('Invalid web root marker');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

function sameWindowsPath(a, b) {
  return (
    win32.normalize(win32.toNamespacedPath(a)).toLowerCase() ===
    win32.normalize(win32.toNamespacedPath(b)).toLowerCase()
  );
}

function pathInside(value) {
  if (typeof value !== 'string' || isAbsolute(value))
    throw new Error('Invalid web link path');
  const path = resolve(root, value);
  const rel = relative(root, path);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error('Web link escapes distribution');
  }
  return path;
}

for (const link of links) {
  const path = pathInside(link.path);
  const target = pathInside(link.target);
  pathInside(relative(root, await realpath(dirname(path))));
  const actualTarget = await realpath(target);
  pathInside(relative(root, actualTarget));
  let current;
  try {
    current = await lstat(path);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  if (current) {
    if (!current.isSymbolicLink())
      throw new Error('Existing web path is not a junction');
    const existingTarget = await readlink(path);
    if (sameWindowsPath(existingTarget, actualTarget)) continue;
    if (
      !previousRoot ||
      !sameWindowsPath(existingTarget, resolve(previousRoot, link.target))
    ) {
      throw new Error('Existing web link does not match manifest');
    }
    await rmdir(path);
  }
  await symlink(actualTarget, path, 'junction');
}
await writeFile(marker, root, 'utf8');
console.log(`Restored ${links.length} web junctions`);
