import { afterAll, expect, test } from 'bun:test';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { createDatabase } from '@anyko/database';
import { createLogger } from '@anyko/logger';
import { createDocumentRuntime } from './document-runtime';
import { createDocumentWorker } from './document-worker';
import { createProcessingStore } from '../modules/processing/infrastructure/store';
import { createSourceCleanup } from '../modules/documents/infrastructure/source-cleanup';
import type { SourceStorage, DocumentView } from '../modules/documents';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).pathname !== '/anyko_test')
  throw new Error('Dedicated anyko_test TEST_DATABASE_URL required');
const redisUrl = process.env.TEST_REDIS_URL;
if (!redisUrl) throw new Error('TEST_REDIS_URL required');
const db = createDatabase(databaseUrl);
const logger = createLogger({
  service: 'worker',
  environment: 'test',
  release: 'integration',
  level: 'error',
});
const files = new Map<string, Uint8Array>();
const storage: SourceStorage = {
  put(key, bytes) {
    files.set(key, bytes);
    return Promise.resolve();
  },
  get(key) {
    const data = files.get(key);
    if (!data) throw new Error('MISSING_OBJECT');
    return Promise.resolve(data);
  },
  delete(key) {
    files.delete(key);
    return Promise.resolve();
  },
};
const runtime = createDocumentRuntime({ databaseUrl, storage, logger });
async function expectRejected(operation: Promise<unknown>, code?: string) {
  let caught: unknown;
  try {
    await operation;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Error);
  if (code) expect(String(caught)).toContain(code);
}
const owned: string[] = [];
async function workspace() {
  const id = crypto.randomUUID();
  await db.anykoWorkspace.create({
    data: { id, name: 'Synthetic integration' },
  });
  owned.push(id);
  return id;
}
const pdf = new TextEncoder().encode('%PDF-1.7\n synthetic fixture');
async function upload(
  workspaceId: string,
  requestKey = crypto.randomUUID(),
  bytes = pdf,
) {
  return runtime.upload({
    workspaceId,
    actorId: 'synthetic-actor',
    filename: 'fixture.pdf',
    bytes,
    requestKey,
    correlationId: crypto.randomUUID(),
  });
}
async function waitFor(
  workspaceId: string,
  documentId: string,
  status: DocumentView['status'],
) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const doc = await runtime.get({ workspaceId, documentId });
    if (doc.status === status) return doc;
    await Bun.sleep(20);
  }
  throw new Error('DOCUMENT_STATUS_TIMEOUT');
}
afterAll(async () => {
  await db.sourceUpload.deleteMany({ where: { workspaceId: { in: owned } } });
  await db.resultUpload.deleteMany({ where: { workspaceId: { in: owned } } });
  await db.processingRun.deleteMany({ where: { workspaceId: { in: owned } } });
  await db.sourceDocument.deleteMany({ where: { workspaceId: { in: owned } } });
  await db.anykoWorkspace.deleteMany({ where: { id: { in: owned } } });
  await runtime.stop();
  await db.$disconnect();
});

test('upload atomically persists metadata, run and outbox; foreign workspace cannot read it', async () => {
  const own = await workspace(),
    foreign = await workspace();
  const document = await upload(own);
  expect(document.status).toBe('queued');
  expect(
    await db.processingRun.count({
      where: { workspaceId: own, documentId: document.id },
    }),
  ).toBe(1);
  expect(await db.processingOutbox.count({ where: { workspaceId: own } })).toBe(
    1,
  );
  expect(await db.sourceUpload.count({ where: { workspaceId: own } })).toBe(0);
  expect(await runtime.list({ workspaceId: foreign })).toEqual([]);
  await expectRejected(
    runtime.get({ workspaceId: foreign, documentId: document.id }),
    'NOT_FOUND',
  );
  await expectRejected(
    runtime.result({ workspaceId: foreign, documentId: document.id }),
    'NOT_FOUND',
  );
  const run = await db.processingRun.findFirstOrThrow({
    where: { workspaceId: own },
  });
  await expectRejected(
    Promise.resolve(
      db.processingOutbox.create({
        data: { id: crypto.randomUUID(), workspaceId: foreign, runId: run.id },
      }),
    ),
  );
});

test('concurrent same-key upload returns the same document; different input conflicts', async () => {
  const own = await workspace(),
    key = crypto.randomUUID();
  const [one, two] = await Promise.all([upload(own, key), upload(own, key)]);
  expect(one.id).toBe(two.id);
  expect(await db.sourceDocument.count({ where: { workspaceId: own } })).toBe(
    1,
  );
  expect(await db.processingRun.count({ where: { workspaceId: own } })).toBe(1);
  await expectRejected(
    upload(own, key, new TextEncoder().encode('%PDF-1.7\nother')),
    'IDEMPOTENCY_CONFLICT',
  );
  const document = await db.sourceDocument.findFirstOrThrow({
    where: { workspaceId: own },
  });
  await db.sourceUpload.create({
    data: { key: document.sourceKey, workspaceId: own, createdAt: new Date(0) },
  });
  await db.sourceUpload.updateMany({
    where: { workspaceId: own },
    data: { createdAt: new Date(0) },
  });
  await createSourceCleanup(db, storage)(new Date(Date.now() - 3600000));
  expect(files.has(document.sourceKey)).toBe(true);
  expect(await db.sourceUpload.count({ where: { workspaceId: own } })).toBe(0);
});

test('outbox survives before worker start; real queue publishes result and retry preserves history', async () => {
  const own = await workspace();
  const doc = await upload(own);
  let reject = true;
  const worker = await createDocumentWorker({
    databaseUrl,
    redisUrl,
    storage,
    logger,
    queueName: `document-test-${crypto.randomUUID()}`,
    parser: {
      parsePdf(input) {
        expect(new TextDecoder().decode(input)).toContain('%PDF-');
        if (reject) throw new Error('controlled failure');
        return Promise.resolve({
          markdown: '# extracted fixture',
          processorVersion: 'test-parser-1',
        });
      },
    },
  });
  try {
    await waitFor(own, doc.id, 'failed');
    reject = false;
    const retried = await runtime.retry({
      workspaceId: own,
      documentId: doc.id,
      actorId: 'synthetic-actor',
      correlationId: crypto.randomUUID(),
    });
    expect(retried.status).toBe('queued');
    await waitFor(own, doc.id, 'succeeded');
    expect(
      await runtime.result({ workspaceId: own, documentId: doc.id }),
    ).toEqual({
      markdown: '# extracted fixture',
      processorVersion: 'test-parser-1',
    });
    expect(
      await db.processingRun.count({
        where: { workspaceId: own, documentId: doc.id },
      }),
    ).toBe(2);
  } finally {
    await worker.stop();
  }
}, 15000);

test('expired attempt cannot publish after a new claim; database rejects impossible state', async () => {
  const own = await workspace();
  const doc = await upload(own);
  const run = await db.processingRun.findFirstOrThrow({
    where: { workspaceId: own, documentId: doc.id },
  });
  const store = createProcessingStore(db);
  const old = await store.claim(
    run.id,
    own,
    'old-attempt',
    new Date(Date.now() - 1000),
  );
  if (!old) throw new Error('claim missing');
  await store.reconcile();
  const current = await store.claim(
    run.id,
    own,
    'new-attempt',
    new Date(Date.now() + 60000),
  );
  if (!current) throw new Error('claim missing');
  await store.stageResult('results/new-fixture', own);
  expect(
    await store.complete(old, 'results/stale-fixture', 'test-parser'),
  ).toBe(false);
  expect(
    await store.complete(current, 'results/new-fixture', 'test-parser'),
  ).toBe(true);
  await expectRejected(
    Promise.resolve(
      db.processingRun.update({
        where: { id: run.id },
        data: { status: 'unrecognised' },
      }),
    ),
  );
  const saved = await db.processingRun.findUniqueOrThrow({
    where: { id: run.id },
  });
  expect(saved.resultKey).toBe('results/new-fixture');
});

test('a lost Redis job is republished from the aged queued database intent', async () => {
  const own = await workspace();
  const doc = await upload(own);
  const run = await db.processingRun.findFirstOrThrow({
    where: { workspaceId: own, documentId: doc.id },
  });
  const store = createProcessingStore(db);
  const item = await store.reserveDelivery(
    crypto.randomUUID(),
    new Date(Date.now() + 30000),
  );
  if (!item || item.runId !== run.id)
    throw new Error('Expected owned outbox reservation');
  const queueName = `document-lost-${crypto.randomUUID()}`;
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  const queue = new Queue(queueName, { connection });
  let worker: Awaited<ReturnType<typeof createDocumentWorker>> | undefined;
  let executions = 0;
  try {
    const job = await queue.add(
      'document.ocr',
      { version: 1, workspaceId: own, runId: run.id },
      { jobId: `${item.id}-lost` },
    );
    await store.delivered(item.id, item.token);
    await queue.remove(job.id ?? 'missing');
    expect(await queue.getJob(job.id ?? 'missing')).toBeUndefined();
    // A fresh delivery has a grace period and must not immediately duplicate.
    await store.reconcile();
    expect(
      (await db.processingOutbox.findUniqueOrThrow({ where: { id: item.id } }))
        .deliveredAt,
    ).not.toBeNull();
    await db.processingOutbox.update({
      where: { id: item.id },
      data: { deliveredAt: new Date(Date.now() - 31000) },
    });
    await store.reconcile();
    expect(
      (await db.processingOutbox.findUniqueOrThrow({ where: { id: item.id } }))
        .deliveredAt,
    ).toBeNull();
    worker = await createDocumentWorker({
      databaseUrl,
      redisUrl,
      storage,
      logger,
      queueName,
      parser: {
        parsePdf() {
          executions++;
          return Promise.resolve({
            markdown: 'Recovered after Redis loss',
            processorVersion: 'test-parser-1',
          });
        },
      },
    });
    await waitFor(own, doc.id, 'succeeded');
    expect(executions).toBe(1);
    expect(
      (await runtime.result({ workspaceId: own, documentId: doc.id })).markdown,
    ).toBe('Recovered after Redis loss');
  } finally {
    await worker?.stop();
    connection.disconnect();
    await queue.close();
  }
});
