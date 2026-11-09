import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  realpath,
  rmdir,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

if (process.platform !== 'win32' || process.arch !== 'x64')
  throw new Error('Windows x64 is required');
const output = resolve(
  process.env.ANYKO_WINDOWS_MINERU_OUTPUT ?? 'work/windows-mineru',
);
const cache = resolve(
  process.env.ANYKO_WINDOWS_UV_CACHE ?? 'work/windows-uv-cache',
);
await mkdir(output, { recursive: true });
const stage = await mkdtemp(resolve(output, 'build-'));
const installDir = resolve(stage, 'python-dist');
const modelHome = resolve(stage, 'home');
const env = {
  ...process.env,
  UV_PYTHON_INSTALL_DIR: installDir,
  UV_CACHE_DIR: cache,
  UV_LINK_MODE: 'copy',
  HF_HOME: resolve(stage, 'hf-build-cache'),
  HF_HUB_DISABLE_XET: '1',
  HF_HUB_DISABLE_TELEMETRY: '1',
  MINERU_HOME: modelHome,
  MINERU_TELEMETRY_DISABLED: '1',
};
delete env.HF_TOKEN;
delete env.HUGGING_FACE_HUB_TOKEN;
delete env.HF_TOKEN_PATH;
delete env.HUGGINGFACE_HUB_TOKEN;
async function command(args, capture = false) {
  const child = Bun.spawn(args, {
    env,
    stdout: capture ? 'pipe' : 'inherit',
    stderr: 'inherit',
  });
  const output = capture ? new Response(child.stdout).text() : null;
  if ((await child.exited) !== 0)
    throw new Error(`Failed: ${args[0]} ${args[1]}`);
  return output ? (await output).trim() : '';
}
await command([
  'uv',
  'python',
  'install',
  '3.12.15',
  '--no-bin',
  '--no-registry',
]);
const python = await command(
  [
    'uv',
    'python',
    'find',
    '3.12.15',
    '--managed-python',
    '--no-python-downloads',
    '--no-project',
  ],
  true,
);
const pyRelative = relative(stage, python);
if (
  !pyRelative ||
  pyRelative === '..' ||
  pyRelative.startsWith(`..${sep}`) ||
  isAbsolute(pyRelative)
) {
  throw new Error('Python is outside the build directory');
}
const expectedPython = await realpath(dirname(python));
async function rejectLinks(directory) {
  for (const entry of await readdir(directory)) {
    const path = resolve(directory, entry);
    const info = await lstat(path);
    if (info.isSymbolicLink()) {
      if (
        dirname(path) !== installDir ||
        (await realpath(path)) !== expectedPython
      ) {
        throw new Error(`Unexpected Python junction: ${path}`);
      }
      await rmdir(path);
    } else if (info.isDirectory()) {
      await rejectLinks(path);
    }
  }
}
await rejectLinks(installDir);
await command([
  'uv',
  'pip',
  'install',
  '--python',
  python,
  '--target',
  resolve(dirname(python), 'Lib/site-packages'),
  '--no-deps',
  '--require-hashes',
  '-r',
  resolve('infra/mineru/requirements-windows.lock'),
]);
await mkdir(modelHome);
await writeFile(
  resolve(modelHome, 'config.yaml'),
  'model:\n  source: huggingface\n  small_backend: onnx\n  onnx_device: cpu\n',
);
await command([
  python,
  resolve('infra/mineru/prepare-portable-models.py'),
  modelHome,
]);
await copyFile('infra/mineru/processor.py', resolve(stage, 'processor.py'));
await writeFile(
  resolve(stage, 'complete.json'),
  JSON.stringify({ format: 1, python: pyRelative }),
);
console.log(`MinerU ready: ${stage}`);
