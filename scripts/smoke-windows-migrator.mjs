import { dlopen, FFIType, ptr } from 'bun:ffi';
import { randomBytes } from 'node:crypto';
import { closeSync, openSync } from 'node:fs';
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
  COMSPEC: resolve(process.env.SystemRoot, 'System32/cmd.exe'),
  TEMP: root,
  TMP: root,
  USERPROFILE: root,
  APPDATA: appdata,
  LOCALAPPDATA: appdata,
  PGPASSWORD: pass,
};
let serverStarted = false;
let serverOwned = false;
let preserveData = false;
let failed = false;
let migrationsApplied;
// The test process owns a kill-on-close job before pg_ctl can spawn children.
// Keep the handle open until Bun exits, including failed/late startup paths.
const win = dlopen('kernel32.dll', {
  CreateJobObjectW: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.ptr },
  SetInformationJobObject: {
    args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.u32],
    returns: FFIType.i32,
  },
  OpenProcess: {
    args: [FFIType.u32, FFIType.i32, FFIType.u32],
    returns: FFIType.ptr,
  },
  AssignProcessToJobObject: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.i32,
  },
  IsProcessInJob: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.ptr],
    returns: FFIType.i32,
  },
  QueryInformationJobObject: {
    args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.u32, FFIType.ptr],
    returns: FFIType.i32,
  },
  CloseHandle: { args: [FFIType.ptr], returns: FFIType.i32 },
});
let job;
let jobAssigned = false;
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
  job = win.symbols.CreateJobObjectW(0, 0);
  const limits = Buffer.alloc(144); // JOBOBJECT_EXTENDED_LIMIT_INFORMATION, x64
  limits.writeUInt32LE(0x2000, 16); // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
  if (
    !job ||
    !win.symbols.SetInformationJobObject(job, 9, ptr(limits), limits.length)
  )
    throw new Error('Cannot create PostgreSQL test supervisor');
  const current = win.symbols.OpenProcess(0x101, 0, process.pid);
  if (!current) throw new Error('Cannot inspect PostgreSQL test supervisor');
  try {
    if (!win.symbols.AssignProcessToJobObject(job, current))
      throw new Error('Cannot supervise PostgreSQL test processes');
    jobAssigned = true;
  } finally {
    win.symbols.CloseHandle(current);
  }
  if ([root, infrastructure].some((path) => /[%!]/.test(path)))
    throw new Error('PostgreSQL smoke requires paths without % or !');
  const whoami = Bun.spawn(
    [
      resolve(env.SystemRoot, 'System32/whoami.exe'),
      '/user',
      '/fo',
      'csv',
      '/nh',
    ],
    { env, stdout: 'pipe', stderr: 'ignore' },
  );
  const identityOutput = new Response(whoami.stdout).text();
  if ((await whoami.exited) !== 0)
    throw new Error('Cannot determine the current Windows user');
  const sid = (await identityOutput).match(/S-\d-(?:\d+-)+\d+/)?.[0];
  if (!sid) throw new Error('Cannot determine the current Windows user SID');
  await command([
    resolve(env.SystemRoot, 'System32/icacls.exe'),
    root,
    '/grant',
    `*${sid}:(OI)(CI)F`,
  ]);
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
  const log = resolve(root, 'postgres.log');
  const controlLog = resolve(root, 'postgres-control.log');
  const controlFd = openSync(controlLog, 'a');
  let startCode;
  try {
    const start = Bun.spawn(
      [
        resolve(bin, 'pg_ctl.exe'),
        '-D',
        data,
        '-l',
        log,
        '-w',
        '-t',
        '60',
        'start',
        '-o',
        `-h 127.0.0.1 -p ${port}`,
      ],
      { env, stdout: controlFd, stderr: controlFd },
    );
    startCode = await start.exited;
  } finally {
    closeSync(controlFd);
  }
  if (startCode !== 0) {
    preserveData = true;
    const output = await readFile(log, 'utf8').catch(
      () => 'No PostgreSQL log was created',
    );
    const control = await readFile(controlLog, 'utf8');
    throw new Error(
      `PostgreSQL failed to start: ${(control + '\n' + output).slice(-8192).replaceAll(pass, '[redacted]')}`,
    );
  }
  serverStarted = true;
  let ready = false;
  for (let i = 0; i < 100; i++) {
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
      const processHandle = win.symbols.OpenProcess(0x101000, 0, pid);
      if (!processHandle) throw new Error('Cannot inspect PostgreSQL process');
      try {
        const member = Buffer.alloc(4);
        if (
          !win.symbols.IsProcessInJob(processHandle, job, ptr(member)) ||
          !member.readInt32LE()
        )
          throw new Error('PostgreSQL is outside the test supervisor');
      } finally {
        win.symbols.CloseHandle(processHandle);
      }
      const netstat = Bun.spawn(
        [resolve(env.SystemRoot, 'System32/netstat.exe'), '-ano', '-p', 'tcp'],
        { env, stdout: 'pipe', stderr: 'ignore' },
      );
      const rows = new Response(netstat.stdout).text();
      if ((await netstat.exited) !== 0)
        throw new Error('Cannot inspect PostgreSQL listener');
      const owned = (await rows).split(/\r?\n/).some((line) => {
        const fields = line.trim().split(/\s+/);
        return (
          fields[0] === 'TCP' &&
          fields[1] === `127.0.0.1:${port}` &&
          Number(fields.at(-1)) === pid
        );
      });
      if (!owned) throw new Error('Unexpected PostgreSQL process');
      serverOwned = true;
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
  migrationsApplied = migrations;
} catch (error) {
  failed = true;
  throw error;
} finally {
  try {
    let cleanupFailure;
    let stopped = true;
    if (serverStarted && serverOwned) {
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
      } catch (error) {
        stopped = false;
        cleanupFailure = new Error('PostgreSQL test shutdown failed', {
          cause: error,
        });
      }
    }
    if (serverStarted && !serverOwned) {
      preserveData = true;
      cleanupFailure = new Error('PostgreSQL ownership could not be confirmed');
    }
    if (stopped && !preserveData && jobAssigned) {
      const accounting = Buffer.alloc(48); // JOBOBJECT_BASIC_ACCOUNTING_INFORMATION, x64
      let empty = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if (
          !win.symbols.QueryInformationJobObject(
            job,
            1,
            ptr(accounting),
            accounting.length,
            0,
          )
        )
          throw new Error('Cannot inspect PostgreSQL test processes');
        if (accounting.readUInt32LE(40) === 1) {
          empty = true;
          break;
        }
        await Bun.sleep(100);
      }
      if (!empty) {
        preserveData = true;
        cleanupFailure = new Error(
          'PostgreSQL test processes did not terminate',
        );
      }
    }
    if (stopped && !preserveData) {
      for (let attempt = 0; ; attempt++) {
        try {
          await rm(actualRoot, { recursive: true, force: true });
          break;
        } catch (error) {
          if (
            attempt >= 9 ||
            !['EPERM', 'EACCES', 'EBUSY', 'ENOTEMPTY'].includes(error.code)
          )
            throw error;
          await Bun.sleep(500);
        }
      }
    } else {
      console.error(`PostgreSQL test data retained at ${actualRoot}`);
      if (cleanupFailure) throw cleanupFailure;
    }
  } catch (error) {
    if (!failed) throw error;
    console.error(`PostgreSQL test cleanup also failed: ${error.message}`);
  }
}
console.log(`Applied ${migrationsApplied} migrations; second deploy succeeded`);
