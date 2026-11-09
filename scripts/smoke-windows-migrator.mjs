import { dlopen, FFIType, ptr } from 'bun:ffi';
import { randomBytes } from 'node:crypto';
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

if (process.platform !== 'win32' || process.arch !== 'x64')
  throw new Error('Windows x64 is required');
if (
  !process.env.ANYKO_WINDOWS_INFRA_PATH ||
  !process.env.ANYKO_WINDOWS_MIGRATOR_PATH
) {
  throw new Error('Set paths to completed infrastructure and migrator builds');
}
const infra = resolve(process.env.ANYKO_WINDOWS_INFRA_PATH);
const migratorSource = resolve(process.env.ANYKO_WINDOWS_MIGRATOR_PATH);
for (const [directory, format] of [
  [infra, 1],
  [migratorSource, 2],
]) {
  if (
    JSON.parse(await readFile(resolve(directory, 'complete.json'), 'utf8'))
      .format !== format
  )
    throw new Error('Incomplete build');
}
// Prefer an ASCII parent even when the user's TEMP contains Unicode and the
// volume does not provide 8.3 aliases. The checkout work directory is isolated.
const tempParent = /^[\x00-\x7f]+$/.test(tmpdir()) ? tmpdir() : resolve('work');
await mkdir(tempParent, { recursive: true });
const actualRoot = await mkdtemp(join(tempParent, 'anyko-db-'));
// initdb passes absolute data paths to a child using the Windows code page.
// Use the same ASCII short-path fallback as the portable launcher.
function postgresPath(path) {
  if (/^[\x00-\x7f]+$/.test(path)) return path;
  const kernel = dlopen('kernel32.dll', {
    GetShortPathNameW: {
      args: [FFIType.ptr, FFIType.ptr, FFIType.u32],
      returns: FFIType.u32,
    },
  });
  try {
    const input = Buffer.from(`${path}\0`, 'utf16le');
    const output = Buffer.alloc(32768 * 2);
    const length = kernel.symbols.GetShortPathNameW(
      ptr(input),
      ptr(output),
      32768,
    );
    const short = output.toString('utf16le', 0, length * 2);
    if (!length || length >= 32768 || !/^[\x00-\x7f]+$/.test(short))
      throw new Error(
        'PostgreSQL smoke requires ASCII paths or Windows 8.3 short names',
      );
    return short;
  } finally {
    kernel.close();
  }
}
let root;
let infrastructure;
try {
  root = postgresPath(actualRoot);
  infrastructure = postgresPath(infra);
} catch (error) {
  await rm(actualRoot, { recursive: true, force: true });
  throw error;
}
const migrator = resolve(root, 'migrator');
const data = resolve(root, 'data');
const bin = resolve(infrastructure, 'postgresql/pgsql/bin');
const pass = randomBytes(24).toString('hex');
const identity = randomBytes(12).toString('hex');
const user = `anyko_${identity}`;
const database = `smoke_${identity}`;
await writeFile(resolve(root, 'password'), pass);
const appdata = resolve(root, 'appdata');
await mkdir(appdata);
const env = {
  SystemRoot: process.env.SystemRoot,
  PATH: resolve(process.env.SystemRoot, 'System32'),
  TEMP: root,
  TMP: root,
  USERPROFILE: root,
  APPDATA: appdata,
  LOCALAPPDATA: appdata,
  PGPASSWORD: pass,
};
let server;
async function command(args, options = {}) {
  const child = Bun.spawn(args, {
    env,
    stdout: 'ignore',
    stderr: 'pipe',
    ...options,
  });
  const err = new Response(child.stderr).text();
  const code = await child.exited;
  if (code !== 0)
    throw new Error(
      `Command failed: ${args[0]}: ${(await err).replaceAll(pass, '[redacted]')}`,
    );
}
try {
  await cp(migratorSource, migrator, { recursive: true });
  const socket = createServer();
  await new Promise((done, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', done);
  });
  const port = socket.address().port;
  await new Promise((done, reject) =>
    socket.close((error) => (error ? reject(error) : done())),
  );
  await command([
    resolve(bin, 'initdb.exe'),
    '-D',
    data,
    '-U',
    user,
    '--pwfile',
    resolve(root, 'password'),
    '--auth',
    'scram-sha-256',
    '--encoding',
    'UTF8',
    '--locale=C',
  ]);
  server = Bun.spawn(
    [
      resolve(bin, 'postgres.exe'),
      '-D',
      data,
      '-h',
      '127.0.0.1',
      '-p',
      String(port),
    ],
    { env, stdout: 'ignore', stderr: 'ignore' },
  );
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error('PostgreSQL exited');
    const probe = Bun.spawn(
      [
        resolve(bin, 'psql.exe'),
        '-h',
        '127.0.0.1',
        '-p',
        String(port),
        '-U',
        user,
        '-d',
        'postgres',
        '-Atc',
        'select 1',
      ],
      { env, stdout: 'pipe', stderr: 'ignore' },
    );
    const directory = new Response(probe.stdout).text();
    if ((await probe.exited) === 0) {
      if ((await directory).trim() !== '1')
        throw new Error('Unexpected PostgreSQL response');
      const pidBytes = await readFile(resolve(data, 'postmaster.pid'));
      const pid = Number(
        pidBytes.subarray(0, pidBytes.indexOf(10)).toString('ascii').trim(),
      );
      if (pid !== server.pid) throw new Error('Unexpected PostgreSQL process');
      ready = true;
      break;
    }
    await Bun.sleep(100);
  }
  if (!ready) throw new Error('PostgreSQL did not become ready');
  await command([
    resolve(bin, 'createdb.exe'),
    '-h',
    '127.0.0.1',
    '-p',
    String(port),
    '-U',
    user,
    database,
  ]);
  const databaseUrl = `postgresql://${user}:${pass}@127.0.0.1:${port}/${database}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    await command(
      [
        resolve(migrator, 'bun.exe'),
        resolve(migrator, 'node_modules/prisma/build/index.js'),
        'migrate',
        'deploy',
      ],
      {
        cwd: resolve(migrator, 'packages/database'),
        env: { ...env, DATABASE_URL: databaseUrl },
      },
    );
  }
  const count = Bun.spawn(
    [
      resolve(bin, 'psql.exe'),
      '-h',
      '127.0.0.1',
      '-p',
      String(port),
      '-U',
      user,
      '-d',
      database,
      '-Atc',
      'select count(*) from _prisma_migrations where finished_at is not null',
    ],
    { env, stdout: 'pipe', stderr: 'ignore' },
  );
  const output = new Response(count.stdout).text();
  if ((await count.exited) !== 0)
    throw new Error('Failed to read migration history');
  const migrations = (
    await readdir(resolve(migrator, 'packages/database/prisma/migrations'), {
      withFileTypes: true,
    })
  ).filter((entry) => entry.isDirectory()).length;
  if (Number((await output).trim()) !== migrations)
    throw new Error('Migration history mismatch');
  console.log(`Applied ${migrations} migrations; second deploy succeeded`);
} finally {
  let stopped = true;
  if (server && server.exitCode === null) {
    try {
      await command([
        resolve(bin, 'pg_ctl.exe'),
        '-D',
        data,
        '-m',
        'fast',
        '-w',
        'stop',
      ]);
    } catch {
      stopped = false;
      server.kill();
    }
    await server.exited;
  }
  if (stopped) await rm(actualRoot, { recursive: true, force: true });
  else
    console.error(`PostgreSQL stop failed; temporary data retained at ${root}`);
}
