import { execFileSync } from 'node:child_process';
import { constants } from 'node:fs';
import { chmod, copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hook = resolve(
  root,
  execFileSync('git', ['rev-parse', '--git-path', 'hooks/pre-commit'], {
    cwd: root,
    encoding: 'utf8',
  }).trim(),
);
await mkdir(dirname(hook), { recursive: true });
try {
  await copyFile(
    resolve(root, '.githooks/pre-commit'),
    hook,
    constants.COPYFILE_EXCL,
  );
  await chmod(hook, 0o755);
  console.log(`Installed ${hook}`);
} catch (error) {
  if (error.code === 'EEXIST') {
    console.error(
      `Hook already exists at ${hook}; merge .githooks/pre-commit into it manually.`,
    );
    process.exitCode = 1;
  } else {
    throw error;
  }
}
