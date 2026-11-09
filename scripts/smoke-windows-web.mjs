import { cp, mkdtemp, rename, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error('Windows x64 is required');
}
const parent = await mkdtemp(join(tmpdir(), 'anyko-web-smoke-'));
let root = resolve(parent, 'web');
let server;
try {
  await cp(process.env.ANYKO_WINDOWS_WEB_OUTPUT ?? 'work/windows-web', root, {
    recursive: true,
  });
  const env = {
    SystemRoot: process.env.SystemRoot,
    TEMP: parent,
    TMP: parent,
    NODE_ENV: 'production',
    HOSTNAME: '127.0.0.1',
    API_ORIGIN: 'http://127.0.0.1:1',
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const bun = resolve(root, 'bun.exe');
    const restore = Bun.spawn([bun, 'restore-windows-web-links.mjs', '.'], {
      cwd: root,
      env,
      stdout: 'ignore',
      stderr: 'inherit',
    });
    if ((await restore.exited) !== 0)
      throw new Error('Failed to restore web links');
    if (attempt === 0) {
      const moved = resolve(parent, 'moved');
      await rename(root, moved);
      root = moved;
    }
  }
  const socket = createServer();
  await new Promise((done, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', done);
  });
  const port = socket.address().port;
  await new Promise((done, reject) =>
    socket.close((error) => (error ? reject(error) : done())),
  );
  server = Bun.spawn(
    [resolve(root, 'bun.exe'), resolve(root, 'apps/web/server.js')],
    {
      cwd: parent,
      env: { ...env, PORT: String(port) },
      stdout: 'ignore',
      stderr: 'ignore',
    },
  );
  let html;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null)
      throw new Error('Web exited before readiness');
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(500),
      });
      if (response.ok) {
        html = await response.text();
        break;
      }
    } catch {
      // The server may still be starting.
    }
    await Bun.sleep(200);
  }
  if (!html) throw new Error('Web did not become ready');
  const asset = html.match(/\/_next\/static\/[^" ?]+/)?.[0];
  if (!asset) throw new Error('Web response has no static asset');
  const response = await fetch(`http://127.0.0.1:${port}${asset}`);
  if (!response.ok || !(await response.arrayBuffer()).byteLength) {
    throw new Error('Web static asset unavailable');
  }
  console.log('Relocated web server and static asset checks passed');
} finally {
  if (server && server.exitCode === null) {
    server.kill();
    await server.exited;
  }
  await rm(parent, { recursive: true, force: true });
}
