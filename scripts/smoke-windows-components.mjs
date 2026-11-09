import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error('Smoke test requires Windows x64');
}

const dir = await mkdtemp(join(tmpdir(), 'anyko-components-'));
const components = resolve(
  process.env.ANYKO_WINDOWS_COMPONENTS_OUTPUT ?? 'work/windows-components',
);
const env = {
  SystemRoot: process.env.SystemRoot,
  TEMP: dir,
  TMP: dir,
  DOCUMENTS_ENABLED: 'false',
  WORKS_ENABLED: 'false',
  NODE_ENV: 'test',
};
let api;
let redis;
let runningWorker;
let invalidWorker;
async function freePort() {
  const socket = createServer();
  await new Promise((done, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', done);
  });
  const port = socket.address().port;
  await new Promise((done, reject) =>
    socket.close((error) => (error ? reject(error) : done())),
  );
  return port;
}
try {
  const templates = Bun.spawn(
    [resolve(components, 'anyko-template-probe.exe')],
    {
      cwd: dir,
      env,
      stdout: 'ignore',
      stderr: 'inherit',
      signal: AbortSignal.timeout(30000),
    },
  );
  if ((await templates.exited) !== 0)
    throw new Error('Compiled template check failed');
  const port = await freePort();
  api = Bun.spawn([resolve(components, 'anyko-api.exe')], {
    cwd: dir,
    env: { ...env, API_PORT: String(port) },
    stdout: 'ignore',
    stderr: 'ignore',
  });
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (api.exitCode !== null) throw new Error('API exited before readiness');
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health/ready`, {
        signal: AbortSignal.timeout(500),
      });
      ready = response.ok && (await response.json()).status === 'ready';
      if (ready) break;
    } catch {
      // The child may still be starting.
    }
    await Bun.sleep(200);
  }
  if (!ready) throw new Error('API did not become ready');

  invalidWorker = Bun.spawn([resolve(components, 'anyko-worker.exe')], {
    cwd: dir,
    env,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const errorOutput = new Response(invalidWorker.stderr).text();
  let timer;
  const workerExit = await Promise.race([
    invalidWorker.exited,
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        invalidWorker.kill();
        reject(new Error('Worker did not reject missing configuration'));
      }, 10000);
    }),
  ]).finally(() => clearTimeout(timer));
  if (
    workerExit === 0 ||
    !(await errorOutput).includes('INVALID_ENV: REDIS_URL')
  ) {
    throw new Error('Worker did not report missing Redis configuration');
  }
  if (process.env.ANYKO_REDIS_EXE) {
    const redisPort = await freePort();
    let workerPort = await freePort();
    while (workerPort === redisPort) workerPort = await freePort();
    redis = Bun.spawn(
      [
        resolve(process.env.ANYKO_REDIS_EXE),
        '--bind',
        '127.0.0.1',
        '--port',
        String(redisPort),
        '--save',
        '',
        '--appendonly',
        'no',
        '--dir',
        dir,
      ],
      { cwd: dir, env, stdout: 'ignore', stderr: 'ignore' },
    );
    runningWorker = Bun.spawn([resolve(components, 'anyko-worker.exe')], {
      cwd: dir,
      env: {
        ...env,
        REDIS_URL: `redis://127.0.0.1:${redisPort}`,
        WORKER_PORT: String(workerPort),
        STARTUP_TIMEOUT_MS: '30000',
      },
      stdout: 'ignore',
      stderr: 'ignore',
    });
    let workerReady = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (redis.exitCode !== null || runningWorker.exitCode !== null)
        throw new Error('Redis or worker exited before readiness');
      try {
        const response = await fetch(
          `http://127.0.0.1:${workerPort}/health/ready`,
          {
            signal: AbortSignal.timeout(500),
          },
        );
        workerReady = response.ok && (await response.json()).status === 'ready';
        if (workerReady) break;
      } catch {
        // The processes may still be starting.
      }
      await Bun.sleep(200);
    }
    if (!workerReady) throw new Error('Worker did not become ready with Redis');
    const diagnostic = Bun.spawn(
      [process.execPath, resolve('apps/worker/src/cli/diagnostic.ts')],
      {
        cwd: dir,
        env: {
          ...env,
          REDIS_URL: `redis://127.0.0.1:${redisPort}`,
          STARTUP_TIMEOUT_MS: '30000',
        },
        stdout: 'pipe',
        stderr: 'ignore',
        signal: AbortSignal.timeout(45000),
      },
    );
    const result = new Response(diagnostic.stdout).text();
    if ((await diagnostic.exited) !== 0) {
      throw new Error('Worker did not complete the diagnostic job');
    }
    if (JSON.parse(await result).status !== 'ok') {
      throw new Error('Worker returned an invalid diagnostic result');
    }
  }
  console.log('API readiness and worker configuration checks passed');
} finally {
  for (const child of [invalidWorker, runningWorker, redis, api]) {
    if (child && child.exitCode === null) {
      child.kill();
      await child.exited;
    }
  }
  await rm(dir, { recursive: true, force: true });
}
