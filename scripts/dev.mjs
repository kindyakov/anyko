import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const root = resolve(import.meta.dirname, '..');
const children = new Set();
let stopping = false;
function launch(command, args, quiet = false) {
  if (stopping) throw new Error('LOCAL_STARTUP_CANCELLED');
  const child = spawn(command, args, {
    cwd: root,
    env: process.env,
    windowsHide: true,
    stdio: quiet ? 'ignore' : 'inherit',
    shell: false,
  });
  children.add(child);
  child.once('error', () => {
    console.error('Local process failed to launch');
    process.exitCode = 1;
    stop();
  });
  child.once('exit', () => children.delete(child));
  return child;
}
async function command(bin, args) {
  const child = launch(bin, args);
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('Preparation command failed')),
    );
  });
}
async function probe(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
    await response.body?.cancel();
    return response.ok;
  } catch {
    return false;
  }
}
async function wait(url, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (stopping) throw new Error('LOCAL_STARTUP_CANCELLED');
    const available = await probe(url);
    if (stopping) throw new Error('LOCAL_STARTUP_CANCELLED');
    if (available) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Local dependency did not become ready');
}
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  const timer = setTimeout(() => {
    for (const child of children) child.kill('SIGKILL');
  }, 15000);
  timer.unref();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
try {
  if (!existsSync(resolve(root, '.env')))
    throw new Error('Create the ignored root .env from .env.example');
  await command('docker', [
    'compose',
    '--env-file',
    '.env',
    '-p',
    'anyko-runtime-test',
    '-f',
    'infra/compose/local.yml',
    '-f',
    'infra/compose/storage.yml',
    'up',
    '-d',
  ]);
  await wait(
    `${process.env.S3_ENDPOINT ?? 'http://127.0.0.1:19020'}/health`,
    30000,
  );
  for (const task of [
    'db:generate',
    'db:migrate',
    'storage:prepare',
    'access:provision-local',
  ])
    await command('bun', ['run', task]);
  const mineruUrl = process.env.MINERU_BASE_URL ?? 'http://127.0.0.1:8020';
  if (!(await probe(`${mineruUrl}/v1/health`))) {
    if (process.platform !== 'win32')
      throw new Error('Start MinerU using docs/engineering/mineru.md');
    launch('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      resolve(root, 'infra/mineru/start.ps1'),
      '-Port',
      new URL(mineruUrl).port || '8020',
    ]);
    await wait(`${mineruUrl}/v1/health`, 120000);
  }
  for (const app of ['api', 'worker', 'web']) {
    const child = launch('bun', ['run', `dev:${app}`]);
    child.once('error', () => {
      process.exitCode = 1;
      stop();
    });
    child.once('exit', () => {
      if (!stopping) {
        process.exitCode = 1;
        stop();
      }
    });
  }
  console.info(
    `Anyko: ${process.env.APP_ORIGIN ?? 'http://127.0.0.1:3020'} — local credentials are in the ignored root .env`,
  );
} catch (error) {
  if (!stopping) {
    console.error(
      error instanceof Error ? error.message : 'Local startup failed',
    );
    process.exitCode = 1;
    stop();
  }
}
