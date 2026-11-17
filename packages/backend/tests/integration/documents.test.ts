import { afterAll, expect, test } from 'bun:test';

import { strToU8, zipSync } from 'fflate';

import { createDatabase, createDatabasePool } from '@anyko/database';
import { createLogger } from '@anyko/logger';
import { createQueueProbe } from '@anyko/worker/testing';

import type {
  DocumentParser,
  DocumentView,
  SourceFormat,
  SourceStorage,
} from '../../src/modules/documents';
import { createSourceCleanup } from '../../src/modules/documents/infrastructure/source-cleanup';
import { createProcessingStore } from '../../src/modules/processing/infrastructure/store';
import { brandDocumentId } from '../../src/platform/ids';
import { createBackend } from '../../src/runtime';
import {
  integrationConfig,
  startDocumentConsumer,
} from '../support/composition';
import { memberScope } from '../support/scope';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).pathname !== '/anyko_test')
  throw new Error('Dedicated anyko_test TEST_DATABASE_URL required');
const redisUrl = process.env.TEST_REDIS_URL;
if (!redisUrl) throw new Error('TEST_REDIS_URL required');
const pool = createDatabasePool(databaseUrl);
const db = createDatabase(pool);
const logger = createLogger({
  service: 'worker',
  environment: 'test',
  release: 'integration',
  level: 'error',
});
const files = new Map<string, Uint8Array>();
const contentTypes = new Map<string, string>();
const storage: SourceStorage = {
  exists: (key) => Promise.resolve(files.has(key)),
  put(key, bytes, contentType) {
    files.set(key, bytes);
    contentTypes.set(key, contentType);
    return Promise.resolve();
  },
  get(key) {
    const data = files.get(key);
    if (!data) throw new Error('MISSING_OBJECT');
    return Promise.resolve(data);
  },
  delete(key) {
    files.delete(key);
    contentTypes.delete(key);
    return Promise.resolve();
  },
};
// Same composition the processes use: one API backend, one worker backend per parser fixture.
const testConfig = integrationConfig({ databaseUrl, redisUrl });
const api = createBackend(testConfig, {
  logger,
  role: 'api',
  dependencies: { storage },
});
const recognition = api.documentHttp.documents;
const startDocumentWorker = (options: {
  queueName: string;
  parser: DocumentParser;
}) => startDocumentConsumer(testConfig, { logger, storage, ...options });
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
  return recognition.commands.upload(
    memberScope(workspaceId, 'synthetic-actor'),
    {
      filename: 'fixture.pdf',
      bytes,
      requestKey,
      correlationId: crypto.randomUUID(),
    },
  );
}
async function waitFor(
  workspaceId: string,
  documentId: string,
  status: DocumentView['status'],
) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const doc = await recognition.queries.get(
      memberScope(workspaceId),
      brandDocumentId(documentId),
    );
    if (doc.status === status) return doc;
    await Bun.sleep(20);
  }
  throw new Error('DOCUMENT_STATUS_TIMEOUT');
}
afterAll(async () => {
  await db.documentIo.deleteMany({ where: { workspaceId: { in: owned } } });
  await db.documentArtifact.deleteMany({
    where: { workspaceId: { in: owned } },
  });
  await db.processorAttempt.deleteMany({
    where: { workspaceId: { in: owned } },
  });
  await db.documentDeletion.deleteMany({
    where: { workspaceId: { in: owned } },
  });
  await db.sourceUpload.deleteMany({ where: { workspaceId: { in: owned } } });
  await db.resultUpload.deleteMany({ where: { workspaceId: { in: owned } } });
  await db.processingRun.deleteMany({ where: { workspaceId: { in: owned } } });
  await db.sourceDocument.deleteMany({ where: { workspaceId: { in: owned } } });
  await db.auditEvent.deleteMany({ where: { workspaceId: { in: owned } } });
  await db.anykoWorkspace.deleteMany({ where: { id: { in: owned } } });
  await api.stop();
  await db.$disconnect();
  await pool.end();
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
  expect(await recognition.queries.list(memberScope(foreign))).toEqual([]);
  await expectRejected(
    recognition.queries.get(memberScope(foreign), brandDocumentId(document.id)),
    'NOT_FOUND',
  );
  await expectRejected(
    recognition.queries.result(
      memberScope(foreign),
      brandDocumentId(document.id),
    ),
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
  const worker = await startDocumentWorker({
    queueName: `document-test-${crypto.randomUUID()}`,
    parser: {
      eraseAttempt: () => Promise.resolve(),
      parseDocument(input) {
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
    const retried = await recognition.commands.retry(
      memberScope(own, 'synthetic-actor'),
      brandDocumentId(doc.id),
      crypto.randomUUID(),
    );
    expect(retried.status).toBe('queued');
    await waitFor(own, doc.id, 'succeeded');
    expect(
      await recognition.queries.result(
        memberScope(own),
        brandDocumentId(doc.id),
      ),
    ).toEqual({
      markdown: '# extracted fixture',
      processorVersion: 'test-parser-1',
      images: [],
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

test('a failed work notification rolls back the OCR claim and attempt', async () => {
  const own = await workspace();
  const doc = await upload(own);
  const run = await db.processingRun.findFirstOrThrow({
    where: { workspaceId: own, documentId: doc.id },
  });
  const store = createProcessingStore(db, () =>
    Promise.reject(new Error('WORK_EVENT_FAILED')),
  );
  await expectRejected(
    store.claim(
      run.id,
      own,
      'event-failure-attempt',
      new Date(Date.now() + 60000),
    ),
  );
  const saved = await db.processingRun.findUniqueOrThrow({
    where: { id: run.id },
  });
  expect(saved.status).toBe('queued');
  expect(saved.attempts).toBe(0);
  expect(
    await db.processorAttempt.count({
      where: { workspaceId: own, documentId: doc.id },
    }),
  ).toBe(0);
  await db.processingOutbox.deleteMany({
    where: { workspaceId: own, runId: run.id },
  });
});

test('recovery notifies the work when an expired final OCR attempt fails', async () => {
  const own = await workspace();
  const doc = await upload(own);
  const run = await db.processingRun.findFirstOrThrow({
    where: { workspaceId: own, documentId: doc.id },
  });
  await db.processingRun.update({
    where: { id: run.id },
    data: {
      status: 'running',
      attempts: 3,
      attemptToken: crypto.randomUUID(),
      leaseUntil: new Date(Date.now() - 60000),
    },
  });
  const notifications: string[] = [];
  const store = createProcessingStore(db, (_tx, workspaceId, documentId) => {
    notifications.push(`${workspaceId}:${documentId}`);
    return Promise.resolve();
  });
  await store.reconcile();
  const saved = await db.processingRun.findUniqueOrThrow({
    where: { id: run.id },
  });
  expect(saved.status).toBe('failed');
  expect(saved.errorCode).toBe('ATTEMPTS_EXHAUSTED');
  expect(notifications).toContain(`${own}:${doc.id}`);
  await db.processingOutbox.deleteMany({
    where: { workspaceId: own, runId: run.id },
  });
});

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
  expect(
    await store.complete(current, 'results/duplicate-fixture', 'test-parser'),
  ).toBe(false);
  expect(
    await db.processorAttempt.count({
      where: { workspaceId: own, documentId: doc.id },
    }),
  ).toBe(2);
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
  const { connection, queue } = createQueueProbe(redisUrl, queueName);
  let worker: Awaited<ReturnType<typeof startDocumentWorker>> | undefined;
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
    worker = await startDocumentWorker({
      queueName,
      parser: {
        eraseAttempt: () => Promise.resolve(),
        parseDocument() {
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
      (
        await recognition.queries.result(
          memberScope(own),
          brandDocumentId(doc.id),
        )
      ).markdown,
    ).toBe('Recovered after Redis loss');
  } finally {
    await worker?.stop();
    connection.disconnect();
    await queue.close();
  }
});

test('document formats survive source storage and queue delivery independently of display filename', async () => {
  const own = await workspace();
  for (const [filename, code] of [
    ['fake.docx', 'INVALID_DOCUMENT'],
    ['unsupported.heic', 'UNSUPPORTED_DOCUMENT_FORMAT'],
  ] as const) {
    await expectRejected(
      recognition.commands.upload(memberScope(own, 'synthetic-actor'), {
        filename,
        bytes: pdf,
        requestKey: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
      }),
      code,
    );
  }
  expect(await db.sourceDocument.count({ where: { workspaceId: own } })).toBe(
    0,
  );
  expect(await db.sourceUpload.count({ where: { workspaceId: own } })).toBe(0);
  expect(
    [...files.keys()].some((key) => key.startsWith(`sources/${own}/`)),
  ).toBe(false);
  const cases: { filename: string; format: SourceFormat; bytes: Uint8Array }[] =
    [
      {
        filename: 'photo.JPEG',
        format: 'jpg',
        bytes: new Uint8Array([255, 216, 255, 224, 0]),
      },
      {
        filename: 'scan.png',
        format: 'png',
        bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      },
      {
        filename: 'scan.webp',
        format: 'webp',
        bytes: strToU8('RIFFxxxxWEBPVP8 '),
      },
      {
        filename: 'scan.tif',
        format: 'tiff',
        bytes: new Uint8Array([73, 73, 42, 0, 8]),
      },
      {
        filename: 'source.docx',
        format: 'docx',
        bytes: zipSync({
          '[Content_Types].xml': strToU8(
            '<Types><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
          ),
          'word/document.xml': strToU8('<w:document><w:body/></w:document>'),
        }),
      },
    ];
  const documents = [];
  for (const item of cases) {
    const document = await recognition.commands.upload(
      memberScope(own, 'synthetic-actor'),
      {
        filename: item.filename,
        bytes: item.bytes,
        requestKey: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
      },
    );
    const source = await db.sourceDocument.findUniqueOrThrow({
      where: { id: document.id },
    });
    expect(source.sourceKey.endsWith(`.${item.format}`)).toBe(true);
    expect(files.get(source.sourceKey)).toEqual(item.bytes);
    if (item.format === 'jpg')
      expect(contentTypes.get(source.sourceKey)).toBe('image/jpeg');
    if (item.format === 'docx')
      expect(contentTypes.get(source.sourceKey)).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
    // Presentation metadata must never decide how a persisted source is parsed.
    await db.sourceDocument.update({
      where: { id: document.id },
      data: { filename: 'renamed.pdf' },
    });
    documents.push({ document, format: item.format });
  }
  const worker = await startDocumentWorker({
    queueName: `document-formats-${crypto.randomUUID()}`,
    parser: {
      eraseAttempt: () => Promise.resolve(),
      parseDocument(_bytes, format) {
        return Promise.resolve({
          markdown: `Extracted ${format}`,
          processorVersion: 'test-format-parser',
        });
      },
    },
  });
  try {
    for (const { document, format } of documents) {
      await waitFor(own, document.id, 'succeeded');
      expect(
        (
          await recognition.queries.result(
            memberScope(own),
            brandDocumentId(document.id),
          )
        ).markdown,
      ).toBe(`Extracted ${format}`);
    }
  } finally {
    await worker.stop();
  }
}, 20000);
