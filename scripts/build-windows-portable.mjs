import { mkdir, mkdtemp, readdir, readFile, rmdir } from 'node:fs/promises';
import { resolve } from 'node:path';

if (process.platform !== 'win32' || process.arch !== 'x64')
  throw new Error('Windows x64 is required');

const root = resolve('.');
await mkdir('work/windows-builds', { recursive: true });
const build = await mkdtemp(resolve('work/windows-builds/build-'));
const env = {
  ...process.env,
  ANYKO_WINDOWS_COMPONENTS_OUTPUT: resolve(build, 'components'),
  ANYKO_WINDOWS_WEB_OUTPUT: resolve(build, 'web'),
  ANYKO_WINDOWS_INFRA_OUTPUT: resolve(build, 'infrastructure'),
  ANYKO_WINDOWS_MIGRATOR_OUTPUT: resolve(build, 'migrator'),
  ANYKO_WINDOWS_MINERU_OUTPUT: resolve(build, 'mineru'),
  ANYKO_WINDOWS_RELEASE_OUTPUT: resolve(build, 'release'),
};
async function run(args, cwd = root) {
  const child = Bun.spawn(args, {
    cwd,
    env,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if ((await child.exited) !== 0) throw new Error(`Failed: ${args.join(' ')}`);
}
async function completed(dir, marker, version) {
  const entries = await readdir(dir, { withFileTypes: true });
  const matches = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const path = resolve(dir, entry.name);
    try {
      if (
        JSON.parse(await readFile(resolve(path, marker), 'utf8')).format ===
        version
      )
        matches.push(path);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (matches.length !== 1)
    throw new Error(`Expected one completed build in ${dir}`);
  return matches[0];
}
const lock = resolve('work/windows-build.lock');
try {
  await mkdir(lock);
} catch (error) {
  if (error.code === 'EEXIST')
    throw new Error(`Another Windows build may be running; see ${lock}`);
  throw error;
}
try {
  const uv = Bun.spawn(['uv', '--version'], {
    stdout: 'pipe',
    stderr: 'inherit',
  });
  const uvVersion = (await new Response(uv.stdout).text()).trim();
  if ((await uv.exited) !== 0 || !/^uv 0\.13\.2(?:\s|$)/.test(uvVersion))
    throw new Error('Install uv 0.13.2 before building');
  await run(['tar', '--version']);
  await run([process.execPath, 'install', '--frozen-lockfile']);
  await run([process.execPath, 'run', 'db:generate']);
  await run([process.execPath, 'run', 'build:windows:components']);
  await run([process.execPath, 'run', 'build:windows:web']);
  for (const [name, variable, version] of [
    ['infrastructure', 'ANYKO_WINDOWS_INFRA_PATH', 1],
    ['migrator', 'ANYKO_WINDOWS_MIGRATOR_PATH', 2],
    ['mineru', 'ANYKO_WINDOWS_MINERU_PATH', 1],
  ]) {
    await run([process.execPath, 'run', `build:windows:${name}`]);
    env[variable] = await completed(
      resolve(build, name),
      'complete.json',
      version,
    );
  }
  await run([process.execPath, 'run', 'build:windows:release']);
  const release = await completed(
    resolve(build, 'release'),
    'Anyko/complete.json',
    1,
  );
  const archive = resolve(build, 'Anyko-windows-x64.zip');
  await run(['tar', '-a', '-c', '-f', archive, 'Anyko'], release);
  console.log(`Windows archive ready: ${archive}`);
} finally {
  await rmdir(lock);
}
