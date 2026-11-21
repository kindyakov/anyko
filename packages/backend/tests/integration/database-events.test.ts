import { expect, test } from 'bun:test';

import { createDatabasePool } from '@anyko/database';

import { createChatProgressFeed } from '../../src/runtime/chat-progress';
import { createDatabaseEvents } from '../../src/runtime/database-events';
import { createChatProgressWriter } from '../../src/workflows/work-chat/progress';

const url = process.env.TEST_DATABASE_URL;
if (!url || !/^\/anyko_test(?:_[a-z0-9_]+)?$/.test(new URL(url).pathname))
  throw new Error('Dedicated anyko_test database required');

test('committed signals wake both subscribers after a lost PostgreSQL listener', async () => {
  const tag = 'test-live-' + crypto.randomUUID();
  const listenerUrl = new URL(url);
  listenerUrl.searchParams.set('application_name', tag);
  const db = createDatabasePool(url);
  const listenerPool = createDatabasePool(listenerUrl.toString());
  const listener = createDatabaseEvents(listenerPool);
  const workspace = crypto.randomUUID();
  const work = crypto.randomUUID();
  const reads = [0, 1].map(() => {
    let cursor = '0';
    let connected = 0;
    const kinds: string[] = [];
    const ready = Promise.withResolvers<null>();
    const stop = listener.subscribe((event) => {
      if (event === 'unavailable' || (event && event.workspaceId !== workspace))
        return;
      if (event === null && ++connected === 2) ready.resolve(null);
    });
    return {
      stop,
      ready: ready.promise,
      async drain() {
        const result = await db.query<{ id: string; kind: string }>(
          'SELECT id::text,kind FROM "WorkEvent" WHERE "workspaceId"=$1 AND "workId"=$2 AND id>$3 ORDER BY id',
          [workspace, work, cursor],
        );
        for (const row of result.rows) {
          kinds.push(row.kind);
          cursor = row.id;
        }
        return kinds;
      },
    };
  });
  const connected = Promise.withResolvers<null>();
  const disconnected = Promise.withResolvers<null>();
  const firstSignal = Promise.withResolvers<null>();
  const eventKinds: string[] = [];
  let firstConnection = false;
  const stop = listener.subscribe((event) => {
    if (event === null) {
      firstConnection = true;
      connected.resolve(null);
    } else if (event === 'unavailable') {
      if (firstConnection) disconnected.resolve(null);
    } else if (event.workspaceId === workspace && event.eventKind) {
      eventKinds.push(event.eventKind);
      if (event.eventKind === 'before.disconnect') firstSignal.resolve(null);
    }
  });
  const append =
    'INSERT INTO "WorkEvent" ("workspaceId","workId",kind) VALUES ($1,$2,$3)';
  try {
    await connected.promise;
    await db.query('INSERT INTO "AnykoWorkspace" (id,name) VALUES ($1,$1)', [
      workspace,
    ]);
    await db.query(
      'INSERT INTO "Work" (id,"workspaceId","packageVersion",title,"createdBy","updatedAt") SELECT $1,$2,version,$1,$1,now() FROM "DocumentPackageVersion" ORDER BY version LIMIT 1',
      [work, workspace],
    );
    const transaction = await db.connect();
    try {
      await transaction.query('BEGIN');
      await transaction.query(append, [workspace, work, 'rolled.back']);
      await transaction.query('ROLLBACK');
    } finally {
      transaction.release();
    }
    await db.query(append, [workspace, work, 'before.disconnect']);
    await firstSignal.promise;
    for (const reader of reads)
      expect(await reader.drain()).toEqual(['before.disconnect']);
    expect(eventKinds).not.toContain('rolled.back');
    const killed = await db.query<{ terminated: boolean }>(
      'SELECT pg_terminate_backend(pid) AS terminated FROM pg_stat_activity WHERE application_name=$1',
      [tag],
    );
    expect(killed.rows).toEqual([{ terminated: true }]);
    await disconnected.promise;
    await db.query(append, [workspace, work, 'while.disconnected']);
    await Promise.all(reads.map(({ ready }) => ready));
    for (const reader of reads)
      expect(await reader.drain()).toEqual([
        'before.disconnect',
        'while.disconnected',
      ]);
    const redis = process.env.TEST_REDIS_URL;
    if (!redis) throw new Error('Dedicated TEST_REDIS_URL required');
    const feed = createChatProgressFeed(redis);
    const scope = { workspaceId: workspace, workId: work };
    const runId = crypto.randomUUID();
    const checkpointStarted = Promise.withResolvers<null>();
    const secondDelta = Promise.withResolvers<null>();
    const cancel = new AbortController();
    const held = await db.connect();
    let checkpointCommitted = false;
    const writer = createChatProgressWriter({
      scope,
      feed,
      runId,
      attempt: 1,
      signal: cancel.signal,
      async checkpoint() {
        checkpointStarted.resolve(null);
        await db.query(append, [workspace, work, 'chat.checkpoint']);
        checkpointCommitted = true;
      },
    });
    const reading = feed.subscribe(scope, '0-0', cancel.signal, (batch) => {
      if (batch.some(({ delta }) => delta.text === 'B'))
        secondDelta.resolve(null);
    });
    try {
      await held.query('BEGIN');
      await held.query(append, [workspace, work, 'holds.cursor.lock']);
      writer.push({ text: 'A', reasoning: '' });
      await checkpointStarted.promise;
      writer.push({ text: 'B', reasoning: '' });
      await Promise.race([
        secondDelta.promise,
        Bun.sleep(1500).then(() => {
          throw new Error('Redis delta is blocked by PostgreSQL');
        }),
      ]);
      expect(checkpointCommitted).toBe(false);
    } finally {
      await held.query('ROLLBACK');
      held.release();
      cancel.abort();
      await writer.close();
      await reading;
      await feed.erase(scope);
      feed.close();
    }
  } finally {
    stop();
    for (const reader of reads) reader.stop();
    await listener.stop();
    await listenerPool.end();
    await db.query('DELETE FROM "Work" WHERE id=$1', [work]);
    await db.query('DELETE FROM "AnykoWorkspace" WHERE id=$1', [workspace]);
    await db.end();
  }
});

test('Redis blocking reads wake on append and can resume from their last ID', async () => {
  const redis = process.env.TEST_REDIS_URL;
  if (!redis) throw new Error('Dedicated TEST_REDIS_URL required');
  const feed = createChatProgressFeed(redis);
  const scope = {
    workspaceId: crypto.randomUUID(),
    workId: crypto.randomUUID(),
  };
  const cancel = new AbortController();
  const received = Promise.withResolvers<string>();
  const runId = crypto.randomUUID();
  const first = feed.subscribe(scope, '0-0', cancel.signal, (rows) => {
    const row = rows[0];
    if (!row) return;
    expect(row.delta.text).toBe('A');
    received.resolve(row.id);
    cancel.abort();
  });
  try {
    await feed.append(scope, {
      runId,
      attempt: 1,
      sequence: 1,
      text: 'A',
      reasoning: '',
    });
    const cursor = await received.promise;
    await first;
    const next = new AbortController();
    const second = feed.subscribe(scope, cursor, next.signal, (rows) => {
      expect(rows.map(({ delta }) => delta.text)).toEqual(['B']);
      next.abort();
    });
    await feed.append(scope, {
      runId,
      attempt: 1,
      sequence: 2,
      text: 'B',
      reasoning: '',
    });
    await second;
  } finally {
    cancel.abort();
    await feed.erase(scope);
    feed.close();
  }
});
