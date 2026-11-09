import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

const root = dirname(process.execPath);
const mineru = resolve(root, 'mineru');
const metadata = JSON.parse(
  await readFile(resolve(mineru, 'complete.json'), 'utf8'),
);
if (
  metadata.format !== 1 ||
  typeof metadata.python !== 'string' ||
  isAbsolute(metadata.python)
) {
  throw new Error('Invalid bundled Python');
}
const python = resolve(mineru, metadata.python);
const path = relative(mineru, python);
if (!path || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)) {
  throw new Error('Invalid bundled Python path');
}
const child = Bun.spawn(
  [python, '-B', resolve(root, 'launcher.py'), String(process.pid)],
  {
    cwd: root,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  },
);
process.exitCode = await child.exited;
