import { spawn } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createTerminalLog } from './terminal-log.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function parseLaunchArgs(args) {
  const [app, mode] = args;
  if (
    args.length !== 2 ||
    !['api', 'worker'].includes(app) ||
    !['dev', 'start'].includes(mode)
  ) {
    throw new Error('Usage: run-local.mjs api|worker dev|start');
  }
  return { app, mode };
}

export function createLogWriter(
  file,
  { maxBytes = 10 * 1024 * 1024, backups = 3 } = {},
) {
  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 1 ||
    !Number.isSafeInteger(backups) ||
    backups < 1 ||
    backups > 10
  ) {
    throw new Error('Invalid log rotation limits');
  }
  mkdirSync(dirname(file), { recursive: true });
  let size = existsSync(file) ? statSync(file).size : 0;
  function rotate() {
    if (existsSync(`${file}.${backups}`)) unlinkSync(`${file}.${backups}`);
    for (let index = backups - 1; index >= 1; index--) {
      if (existsSync(`${file}.${index}`))
        renameSync(`${file}.${index}`, `${file}.${index + 1}`);
    }
    if (existsSync(file)) renameSync(file, `${file}.1`);
    size = 0;
  }
  return {
    write(chunk) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      let offset = 0;
      while (offset < bytes.length) {
        if (size >= maxBytes) rotate();
        const count = Math.min(maxBytes - size, bytes.length - offset);
        appendFileSync(file, bytes.subarray(offset, offset + count));
        size += count;
        offset += count;
      }
    },
  };
}

async function main(args) {
  let config;
  let writer;
  try {
    config = parseLaunchArgs(args);
    writer = createLogWriter(
      resolve(root, 'apps', config.app, '.logs', 'runtime.log'),
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Local launcher failed',
    );
    process.exitCode = 2;
    return;
  }
  const child = spawn(
    'bun',
    [
      ...[resolve(root, '.env'), resolve(root, 'apps', config.app, '.env')]
        .filter(existsSync)
        .flatMap((file) => ['--env-file', file]),
      ...(config.mode === 'dev' ? ['--watch'] : []),
      resolve(root, 'apps', config.app, 'src', 'index.ts'),
    ],
    {
      cwd: root,
      env: process.env,
      shell: false,
      stdio: ['inherit', 'pipe', 'pipe'],
    },
  );
  let killTimer;
  let sinkFailed = false;
  function stop(signal) {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill(signal);
    killTimer ??= setTimeout(() => child.kill('SIGKILL'), 15000);
    killTimer.unref();
  }
  const onInterrupt = () => stop('SIGINT');
  const onTerminate = () => stop('SIGTERM');
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onTerminate);
  const terminal = process.stdout.isTTY
    ? createTerminalLog(process.stdout, { color: !('NO_COLOR' in process.env) })
    : process.stdout;
  function tee(chunk, output) {
    try {
      writer.write(chunk);
      output.write(chunk);
    } catch {
      if (!sinkFailed)
        console.error('Local log sink failed; stopping application');
      sinkFailed = true;
      stop('SIGTERM');
    }
  }
  child.stdout.on('data', (chunk) => tee(chunk, terminal));
  child.stdout.on('end', () => {
    if (terminal !== process.stdout) terminal.end();
  });
  child.stderr.on('data', (chunk) => tee(chunk, process.stderr));
  child.once('error', () => {
    sinkFailed = true;
    console.error('Unable to start local Bun process');
  });
  await new Promise((done) => {
    child.once('close', (code, signal) => {
      process.off('SIGINT', onInterrupt);
      process.off('SIGTERM', onTerminate);
      if (killTimer) clearTimeout(killTimer);
      process.exitCode = sinkFailed
        ? 1
        : (code ?? (signal === 'SIGINT' ? 130 : 143));
      done();
    });
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main(process.argv.slice(2));
}
