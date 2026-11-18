import { expect, test } from 'bun:test';

import {
  createDatabase,
  createDatabasePool,
  createLockPool,
  createResourceLocks,
} from '@anyko/database';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (
  !databaseUrl ||
  !/^\/anyko_test(?:_[a-z0-9_]+)?$/.test(new URL(databaseUrl).pathname)
)
  throw new Error(
    'Dedicated anyko_test or anyko_test_<worktree> TEST_DATABASE_URL required',
  );

// Same wiring as the composition root: queries and session locks use separate pools.
// Waiters on one key hold a connection each while they poll, so 20 of them would take a
// shared query pool of 20 and leave the lock holder no connection for its own query.
test('a query under a held lock completes while twenty waiters poll for the same key', async () => {
  const queries = createDatabasePool(databaseUrl);
  const lockPool = createLockPool(databaseUrl);
  const db = createDatabase(queries);
  const locks = createResourceLocks(lockPool);
  const key = `lock-pool-${crypto.randomUUID()}`;
  const waiters = 20;
  let markLocked!: () => void;
  const locked = new Promise<void>((resolve) => {
    markLocked = resolve;
  });
  let startQuery!: () => void;
  const go = new Promise<void>((resolve) => {
    startQuery = resolve;
  });
  let queued: Promise<string>[] = [];
  const holder = locks.run(key, async () => {
    markLocked();
    await go;
    const rows = await db.$queryRaw<{ value: number }[]>`SELECT 1 AS value`;
    return rows[0]?.value;
  });
  try {
    await locked;
    queued = Array.from({ length: waiters }, () =>
      locks.run(key, () => Promise.resolve('ok')),
    );
    // Let the waiters take their connections and start polling before the query runs.
    await Bun.sleep(500);
    startQuery();
    expect(await holder).toBe(1);
    expect(await Promise.all(queued)).toEqual(
      Array<string>(waiters).fill('ok'),
    );
  } finally {
    startQuery();
    await Promise.allSettled([holder, ...queued]);
    await db.$disconnect();
    await lockPool.end();
    await queries.end();
  }
}, 60000);
