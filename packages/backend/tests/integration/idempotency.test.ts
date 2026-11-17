import { afterAll, expect, test } from 'bun:test';

import { createDatabase, createDatabasePool } from '@anyko/database';
import { createLogger } from '@anyko/logger';

import {
  createIdempotency,
  createIdempotencyMaintenance,
  fingerprintInput,
  IdempotencyFailure,
} from '../../src/modules/idempotency';
import { createIdempotencyMaintenanceStore } from '../../src/modules/idempotency/infrastructure/maintenance-store';
import { createIdempotencyStore } from '../../src/modules/idempotency/infrastructure/store';
import type { Clock } from '../../src/platform/clock';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).pathname !== '/anyko_test')
  throw new Error('Dedicated anyko_test TEST_DATABASE_URL required');
const pool = createDatabasePool(databaseUrl);
const db = createDatabase(pool);
const logger = createLogger({
  service: 'api',
  environment: 'test',
  release: 'idempotency-integration',
  level: 'error',
});

// Часы подменяются: срок результата и срок захвата проверяются без ожидания.
let current = new Date('2026-11-17T10:00:00.000Z');
const clock: Clock = { now: () => current };
const api = createIdempotency({
  store: createIdempotencyStore(db),
  clock,
  newToken: () => crypto.randomUUID(),
  logger,
});
const store = createIdempotencyStore(db);

const command = 'POST /workspaces/:workspaceId/works';
const owned: string[] = [];

async function workspace() {
  const id = crypto.randomUUID();
  await db.anykoWorkspace.create({
    data: { id, name: 'Synthetic idempotency' },
  });
  owned.push(id);
  return id;
}

async function expectFailure(operation: Promise<unknown>, code: string) {
  let caught: unknown;
  try {
    await operation;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(IdempotencyFailure);
  expect(caught).toMatchObject({ code, kind: 'conflict' });
}

afterAll(async () => {
  await db.idempotencyKey.deleteMany({
    where: { workspaceId: { in: owned } },
  });
  await db.anykoWorkspace.deleteMany({ where: { id: { in: owned } } });
  await db.$disconnect();
  await pool.end();
});

test('the same key and input return the stored response and run the command once', async () => {
  const ws = await workspace();
  const key = crypto.randomUUID();
  const fingerprint = await fingerprintInput({ params: { workspaceId: ws } });
  let calls = 0;
  const execute = () => {
    calls++;
    return Promise.resolve({
      status: 201,
      body: { id: crypto.randomUUID(), title: 'Synthetic work' },
    });
  };
  const first = await api.run(
    { workspaceId: ws, command, key, fingerprint },
    execute,
  );
  const second = await api.run(
    { workspaceId: ws, command, key, fingerprint },
    execute,
  );
  expect(calls).toBe(1);
  expect(first.replayed).toBe(false);
  expect(second).toEqual({ ...first, replayed: true });
});

test('the same key with another input is a conflict and runs nothing', async () => {
  const ws = await workspace();
  const key = crypto.randomUUID();
  const original = await fingerprintInput({ body: { title: 'First' } });
  const other = await fingerprintInput({ body: { title: 'Second' } });
  let calls = 0;
  const execute = () => {
    calls++;
    return Promise.resolve({ status: 201, body: { ok: true } });
  };
  await api.run(
    { workspaceId: ws, command, key, fingerprint: original },
    execute,
  );
  await expectFailure(
    api.run({ workspaceId: ws, command, key, fingerprint: other }, execute),
    'IDEMPOTENCY_CONFLICT',
  );
  expect(calls).toBe(1);
});

test('a request with the same key while the first is running is refused as in progress', async () => {
  const ws = await workspace();
  const key = crypto.randomUUID();
  const fingerprint = await fingerprintInput({ body: { title: 'Running' } });
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started: () => void = () => undefined;
  const runningStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  let calls = 0;
  const running = api.run(
    { workspaceId: ws, command, key, fingerprint },
    async () => {
      calls++;
      started();
      await gate;
      return { status: 201, body: { ok: true } };
    },
  );
  // Второй запрос приходит только после того, как первый захватил ключ и начал выполнение.
  await runningStarted;
  await expectFailure(
    api.run({ workspaceId: ws, command, key, fingerprint }, () => {
      calls++;
      return Promise.resolve({ status: 201, body: { ok: false } });
    }),
    'IDEMPOTENCY_IN_PROGRESS',
  );
  release();
  expect((await running).replayed).toBe(false);
  expect(calls).toBe(1);
});

test('a failed run releases its capture so the same key runs again', async () => {
  const ws = await workspace();
  const key = crypto.randomUUID();
  const fingerprint = await fingerprintInput({ body: { title: 'Retry' } });
  let calls = 0;
  const failing = api.run(
    { workspaceId: ws, command, key, fingerprint },
    () => {
      calls++;
      return Promise.reject(new Error('SYNTHETIC_SCENARIO_FAILURE'));
    },
  );
  let caught: unknown;
  try {
    await failing;
  } catch (error) {
    caught = error;
  }
  expect(caught).toMatchObject({ message: 'SYNTHETIC_SCENARIO_FAILURE' });
  const retried = await api.run(
    { workspaceId: ws, command, key, fingerprint },
    () => {
      calls++;
      return Promise.resolve({ status: 201, body: { attempt: 2 } });
    },
  );
  expect(calls).toBe(2);
  expect(retried).toEqual({
    status: 201,
    body: { attempt: 2 },
    replayed: false,
  });
});

test('the same key in another workspace is an independent command', async () => {
  const first = await workspace();
  const second = await workspace();
  const key = crypto.randomUUID();
  const fingerprint = await fingerprintInput({ body: { title: 'Shared key' } });
  let calls = 0;
  const execute = () => {
    calls++;
    return Promise.resolve({ status: 201, body: { calls } });
  };
  await api.run({ workspaceId: first, command, key, fingerprint }, execute);
  const other = await api.run(
    { workspaceId: second, command, key, fingerprint },
    execute,
  );
  expect(other.replayed).toBe(false);
  expect(calls).toBe(2);
});

test('an expired result is treated as absent and the command runs again', async () => {
  const ws = await workspace();
  const key = crypto.randomUUID();
  const fingerprint = await fingerprintInput({ body: { title: 'Expiring' } });
  const start = current;
  await api.run({ workspaceId: ws, command, key, fingerprint }, () =>
    Promise.resolve({ status: 201, body: { round: 1 } }),
  );
  current = new Date(start.getTime() + 24 * 60 * 60 * 1000 + 1000);
  try {
    const again = await api.run(
      { workspaceId: ws, command, key, fingerprint },
      () => Promise.resolve({ status: 201, body: { round: 2 } }),
    );
    expect(again).toEqual({ status: 201, body: { round: 2 }, replayed: false });
  } finally {
    current = start;
  }
});

test('a capture left by a crashed process is taken over after its lease expires', async () => {
  const ws = await workspace();
  const key = crypto.randomUUID();
  const fingerprint = await fingerprintInput({ body: { title: 'Crashed' } });
  const start = current;
  const ref = { workspaceId: ws, command, key };
  // Процесс захватил ключ и упал: записи нет результата, захват не снят.
  const crashedToken = crypto.randomUUID();
  const crashed = await store.acquire({
    ...ref,
    fingerprint,
    token: crashedToken,
    now: start,
    expiresAt: new Date(start.getTime() + 24 * 60 * 60 * 1000),
    lockedUntil: new Date(start.getTime() + 5 * 60 * 1000),
  });
  expect(crashed).toEqual({ kind: 'acquired' });
  // Пока захват действует, повтор ждёт.
  await expectFailure(
    api.run({ ...ref, fingerprint }, () =>
      Promise.resolve({ status: 201, body: {} }),
    ),
    'IDEMPOTENCY_IN_PROGRESS',
  );
  current = new Date(start.getTime() + 6 * 60 * 1000);
  try {
    const taken = await api.run({ ...ref, fingerprint }, () =>
      Promise.resolve({ status: 201, body: { taken: true } }),
    );
    expect(taken).toEqual({
      status: 201,
      body: { taken: true },
      replayed: false,
    });
    // Старый владелец больше не может записать результат: токен захвата уже сменился.
    const lateWrite = await store.complete(
      ref,
      crashedToken,
      { status: 201, body: { late: true } },
      current,
    );
    expect(lateWrite).toBe(false);
  } finally {
    current = start;
  }
});

test('retention cleanup batches expired keys and preserves fresh and actively claimed keys', async () => {
  const workspaceId = await workspace();
  const now = new Date('2026-11-18T10:00:00.000Z');
  const old = new Date(now.getTime() - 25 * 3600000);
  const expired = new Date(now.getTime() - 3600000);
  const future = new Date(now.getTime() + 3600000);
  const expiredKeys = Array.from({ length: 105 }, () => crypto.randomUUID());
  const fresh = crypto.randomUUID();
  const claimed = crypto.randomUUID();
  await db.idempotencyKey.createMany({
    data: [
      ...expiredKeys.map((key) => ({
        workspaceId,
        command,
        key,
        fingerprint: 'expired',
        token: crypto.randomUUID(),
        state: 'completed',
        createdAt: old,
        expiresAt: expired,
        lockedUntil: old,
      })),
      {
        workspaceId,
        command,
        key: fresh,
        fingerprint: 'fresh',
        token: crypto.randomUUID(),
        state: 'completed',
        createdAt: now,
        expiresAt: future,
        lockedUntil: now,
      },
      {
        workspaceId,
        command,
        key: claimed,
        fingerprint: 'claimed',
        token: crypto.randomUUID(),
        state: 'in_progress',
        createdAt: old,
        expiresAt: expired,
        lockedUntil: future,
      },
    ],
  });
  const maintenance = createIdempotencyMaintenance({
    store: createIdempotencyMaintenanceStore(db),
    clock: { now: () => now },
  });
  await Promise.all([
    maintenance.internal.cleanup(new AbortController().signal),
    maintenance.internal.cleanup(new AbortController().signal),
  ]);
  expect(
    await db.idempotencyKey.count({
      where: { workspaceId, key: { in: expiredKeys } },
    }),
  ).toBe(0);
  expect(
    (
      await db.idempotencyKey.findMany({
        where: { workspaceId },
        select: { key: true },
      })
    )
      .map((row) => row.key)
      .sort(),
  ).toEqual([fresh, claimed].sort());
  await maintenance.internal.cleanup(new AbortController().signal);
  expect(await db.idempotencyKey.count({ where: { workspaceId } })).toBe(2);
});
