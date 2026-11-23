import { expect, test } from 'bun:test';

import {
  createDatabase,
  createDatabasePool,
  createResourceLocks,
} from '@anyko/database';
import { createLogger } from '@anyko/logger';

import {
  type DocumentParser,
  type SourceStorage,
  StorageWriteOutcomeUnknown,
} from '../../../packages/backend/src/modules/documents';
import { createArtifactRegistry } from '../../../packages/backend/src/modules/documents/infrastructure/artifact-store';
import { createDeletionStore } from '../../../packages/backend/src/modules/documents/infrastructure/deletion-store';
import { claimDocumentAttempt } from '../../../packages/backend/src/modules/processing';
import { createProcessingIo } from '../../../packages/backend/src/modules/processing/infrastructure/io';
import { createDocumentProcessingStore } from '../../../packages/backend/src/modules/processing/infrastructure/store';
import { notifyDocumentChanged } from '../../../packages/backend/src/modules/works/application/notify-document-changed';
import { createWorkStore } from '../../../packages/backend/src/modules/works/infrastructure/store';
import {
  brandDocumentId,
  uuidV7,
} from '../../../packages/backend/src/platform/ids';
import { createBackend } from '../../../packages/backend/src/runtime';
import {
  readCatalogDeletionImpact,
  requestCatalogDeletion,
} from '../../../packages/backend/src/runtime/documents/catalog-deletion';
import { finishDocumentDeletion } from '../../../packages/backend/src/runtime/documents/unit-of-work';
import { createUnitOfWork } from '../../../packages/backend/src/runtime/transactions';
import { createDocumentDeletionWorkflow } from '../../../packages/backend/src/workflows/document-deletion';
import { createDocumentOcrWorkflow } from '../../../packages/backend/src/workflows/document-ocr';
import { memberScope } from '../../../packages/backend/tests/support/scope';

import {
  integrationConfig,
  startDocumentConsumer,
} from './support/composition';
const databaseUrl = process.env.TEST_DATABASE_URL,
  redisUrl = process.env.TEST_REDIS_URL;
if (
  !databaseUrl ||
  !/^\/anyko_test(?:_[a-z0-9_]+)?$/.test(new URL(databaseUrl).pathname) ||
  !redisUrl
)
  throw new Error('Dedicated test services required');
const logger = createLogger({
  service: 'worker',
  environment: 'test',
  release: 'erasure-test',
  level: 'fatal',
});
const testConfig = integrationConfig({ databaseUrl, redisUrl });
function startApi(storage: SourceStorage) {
  return createBackend(testConfig, {
    logger,
    role: 'api',
    dependencies: { storage },
  });
}
const startDocumentWorker = (
  storage: SourceStorage,
  options: { queueName: string; parser: DocumentParser },
) => startDocumentConsumer(testConfig, { logger, storage, ...options });
async function rejected(operation: Promise<unknown>, code: string) {
  let caught: unknown;
  try {
    await operation;
  } catch (error) {
    caught = error;
  }
  expect(String(caught)).toContain(code);
}

test('catalog deletion and claiming a replacement OCR run share the same lock order', async () => {
  const pool = createDatabasePool(databaseUrl);
  const db = createDatabase(pool);
  const workspaceId = crypto.randomUUID();
  const documentId = crypto.randomUUID();
  const workId = crypto.randomUUID();
  const runId = crypto.randomUUID();
  const where = { workspaceId };
  const notifyEntered = Promise.withResolvers<number>();
  const releaseNotify = Promise.withResolvers<undefined>();
  let completed: Promise<PromiseSettledResult<unknown>[]> | undefined;
  try {
    await db.anykoWorkspace.create({
      data: { id: workspaceId, name: 'OCR lock order' },
    });
    await db.sourceDocument.create({
      data: {
        workspaceId,
        id: documentId,
        filename: 'ocr-lock.pdf',
        size: 1,
        sourceKey: documentId,
        sourceChecksum: documentId,
        requestKey: documentId,
        createdBy: 'fixture',
      },
    });
    await db.run.createMany({
      data: [1, 2].map((revision) => ({
        workspaceId,
        documentId,
        id: revision === 2 ? runId : crypto.randomUUID(),
        kind: 'document.ocr',
        revision,
        status: revision === 2 ? 'queued' : 'succeeded',
        ...(revision === 1 && {
          resultKey: 'fixture',
          processorVersion: 'fixture',
        }),
        initiatedBy: 'fixture',
        correlationId: crypto.randomUUID(),
      })),
    });
    await db.work.create({
      data: {
        workspaceId,
        id: workId,
        title: 'OCR lock order',
        createdBy: 'fixture',
        packageVersion: 'technical-document-v1',
        documents: { create: { documentId, ocrRevision: 1 } },
      },
    });
    const impact = await readCatalogDeletionImpact(db, workspaceId, documentId);
    if (!impact) throw new Error('Missing deletion impact');
    const processing = createDocumentProcessingStore(
      db,
      async (tx, workspace, document) => {
        const connection = tx as Parameters<typeof createWorkStore>[0];
        const [row] = await connection.$queryRaw<
          { pid: number }[]
        >`SELECT pg_backend_pid() AS pid`;
        if (!row) throw new Error('Missing OCR connection');
        notifyEntered.resolve(row.pid);
        await releaseNotify.promise;
        await notifyDocumentChanged(createWorkStore(connection))(
          workspace,
          document,
        );
      },
    );
    const claim = processing.claim(
      workspaceId,
      runId,
      crypto.randomUUID(),
      new Date(Date.now() + 60_000),
    );
    completed = Promise.allSettled([claim]);
    const pid = await Promise.race([
      notifyEntered.promise,
      claim.then(() => {
        throw new Error('OCR claim finished before notifying work');
      }),
    ]);
    const deletion = db.$transaction((tx) =>
      requestCatalogDeletion(tx, workspaceId, documentId, 'fixture', {
        canDeleteLinked: true,
        token: impact.token,
      }),
    );
    completed = Promise.allSettled([claim, deletion]);
    const deadline = Date.now() + 2500;
    for (;;) {
      const result = await pool.query<{ waiting: boolean }>(
        'SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))) AS waiting',
        [pid],
      );
      if (result.rows[0]?.waiting) break;
      if (Date.now() > deadline)
        throw new Error('Deletion did not wait for the OCR transaction');
      await Bun.sleep(15);
    }
    releaseNotify.resolve(undefined);
    const [claimed, deleted] = await completed;
    expect(claimed).toMatchObject({
      status: 'fulfilled',
      value: { snapshot: { id: runId } },
    });
    expect(deleted).toEqual({ status: 'fulfilled', value: true });
    expect(
      await db.run.findUnique({
        where: { id: runId },
        select: { errorCode: true },
      }),
    ).toEqual({ errorCode: 'DOCUMENT_DELETED' });
  } finally {
    releaseNotify.resolve(undefined);
    await completed;
    await db.workEvent.deleteMany({ where });
    await db.work.deleteMany({ where });
    await db.run.deleteMany({ where });
    await db.documentDeletion.deleteMany({ where });
    await db.sourceDocument.deleteMany({ where });
    await db.auditEvent.deleteMany({ where });
    await db.anykoWorkspace.deleteMany({ where: { id: workspaceId } });
    await db.$disconnect();
    await pool.end();
  }
}, 15000);

test('separate images and all document data are physically erased; unknown/active writers block completion', async () => {
  const pool = createDatabasePool(databaseUrl),
    db = createDatabase(pool),
    locks = createResourceLocks(pool);
  const workspaceId = crypto.randomUUID(),
    files = new Map<string, Uint8Array>();
  const failures = { storage: false, processor: false };
  const erased = new Set<string>();
  const storage: SourceStorage = {
    put(key, bytes) {
      files.set(key, bytes);
      return Promise.resolve();
    },
    get(key) {
      const value = files.get(key);
      if (!value) throw new Error('MISSING');
      return Promise.resolve(value);
    },
    delete(key) {
      if (failures.storage) throw new Error('STORAGE_DOWN');
      files.delete(key);
      return Promise.resolve();
    },
    exists: (key) => Promise.resolve(files.has(key)),
  };
  const api = startApi(storage);
  const recognition = api.documentHttp.documents;
  const processing = createDocumentProcessingStore(db),
    registry = createArtifactRegistry(db);
  const eraseAttempt = (id: string) => {
    if (failures.processor) throw new Error('PROCESSOR_DOWN');
    erased.add(id);
    return Promise.resolve();
  };
  const cleanup = createDocumentDeletionWorkflow({
    ...createDeletionStore(db),
    resultKeys: processing.resultKeys,
    attemptIds: processing.attemptIds,
    eraseAttempt,
    eraseThread: () => Promise.resolve(),
    finish: (scope, id, keys, threadIds) =>
      finishDocumentDeletion(db, scope, id, keys, threadIds),
    locks,
    storage,
    logger,
  });
  let worker: Awaited<ReturnType<typeof startDocumentWorker>> | undefined;
  const input = {
    workspaceId,
    actorId: 'fixture',
    filename: 'fixture.pdf',
    bytes: new TextEncoder().encode('%PDF-1.7 fixture'),
    requestKey: crypto.randomUUID(),
    correlationId: crypto.randomUUID(),
  };
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  try {
    await db.anykoWorkspace.create({
      data: { id: workspaceId, name: 'Synthetic erasure' },
    });
    const document = await recognition.commands.upload(
      memberScope(input.workspaceId, input.actorId),
      input,
    );
    worker = await startDocumentWorker(storage, {
      queueName: `erasure-${crypto.randomUUID()}`,
      parser: {
        eraseAttempt,
        parseDocument: () =>
          Promise.resolve({
            markdown: '![figure](images/a.png)',
            processorVersion: 'fixture',
            images: [
              { path: 'images/a.png', contentType: 'image/png', bytes: png },
            ],
          }),
      },
    });
    const deadline = Date.now() + 8000;
    while (
      (
        await recognition.queries.get(
          memberScope(workspaceId),
          brandDocumentId(document.id),
        )
      ).status !== 'succeeded'
    ) {
      if (Date.now() > deadline) throw new Error('PROCESSING_TIMEOUT');
      await Bun.sleep(20);
    }
    await worker.stop();
    worker = undefined;
    const artifacts = await db.documentArtifact.findMany({
      where: { workspaceId, documentId: document.id },
    });
    expect(artifacts.map((row) => row.kind).sort()).toEqual([
      'image',
      'result',
      'source',
    ]);
    const manifest = artifacts.find((row) => row.kind === 'result');
    if (!manifest) throw new Error('No manifest');
    const json = new TextDecoder().decode(await storage.get(manifest.key));
    expect(json).not.toContain('base64');
    expect(json).toContain('"key":');
    expect(
      await recognition.queries.image(
        memberScope(workspaceId),
        brandDocumentId(document.id),
        0,
      ),
    ).toEqual({ bytes: png, contentType: 'image/png' });
    await rejected(
      recognition.commands.remove(
        memberScope(crypto.randomUUID()),
        brandDocumentId(document.id),
      ),
      'NOT_FOUND',
    );
    const removedWorkId = crypto.randomUUID();
    const deletedWorkId = crypto.randomUUID();
    for (const [workId, deleted] of [
      [removedWorkId, false],
      [deletedWorkId, true],
    ] as const) {
      await db.work.create({
        data: {
          id: workId,
          workspaceId,
          packageVersion: 'technical-document-v1',
          title: 'Historical link',
          createdBy: input.actorId,
          deletedAt: deleted ? new Date() : null,
          documents: {
            create: {
              documentId: document.id,
              ocrRevision: 1,
              removed: !deleted,
            },
          },
        },
      });
    }
    expect(
      (
        await recognition.queries.deletionImpact(
          memberScope(workspaceId),
          brandDocumentId(document.id),
        )
      ).works,
    ).toEqual([]);
    await recognition.commands.remove(
      memberScope(workspaceId),
      brandDocumentId(document.id),
    );
    failures.processor = true;
    await cleanup();
    expect(
      (
        await recognition.queries.deletion(
          memberScope(workspaceId),
          brandDocumentId(document.id),
        )
      ).status,
    ).toBe('deleting');
    expect(files.size).toBe(3);
    failures.processor = false;
    failures.storage = true;
    await cleanup();
    expect(
      (
        await recognition.queries.deletion(
          memberScope(workspaceId),
          brandDocumentId(document.id),
        )
      ).status,
    ).toBe('deleting');
    failures.storage = false;
    await db.workFacts.create({
      data: {
        workspaceId,
        workId: removedWorkId,
        payload: { synthetic: true },
      },
    });
    await cleanup();
    expect(
      await db.workDocument.count({
        where: { workspaceId, workId: removedWorkId },
      }),
    ).toBe(1);
    const maintenance = createBackend(testConfig, {
      logger,
      role: 'worker',
      dependencies: { storage },
    });
    try {
      const job = maintenance.jobs.registry.definitions.find(
        (entry) =>
          entry.kind === 'scheduled' && entry.name === 'work.maintenance',
      );
      if (!job || job.kind !== 'scheduled')
        throw new Error('Missing work maintenance');
      const signal = new AbortController().signal;
      await job.execute(
        {
          logger,
          clock: maintenance.jobs.clock,
          signal,
          correlationId: crypto.randomUUID(),
        },
        {},
        signal,
      );
    } finally {
      await maintenance.stop();
    }
    expect(
      await db.workFacts.findUnique({ where: { workId: removedWorkId } }),
    ).toBeNull();
    await cleanup();
    expect(files.size).toBe(0);
    expect(erased.size).toBeGreaterThan(0);
    expect(await db.sourceDocument.count({ where: { workspaceId } })).toBe(0);
    expect(
      await db.workDocument.count({
        where: { workspaceId, documentId: document.id },
      }),
    ).toBe(0);
    expect(
      await db.work.count({
        where: { workspaceId, id: { in: [removedWorkId, deletedWorkId] } },
      }),
    ).toBe(2);
    expect(await db.run.count({ where: { workspaceId } })).toBe(0);
    expect(await db.documentArtifact.count({ where: { workspaceId } })).toBe(0);
    expect(await db.runAttempt.count({ where: { workspaceId } })).toBe(0);
    expect(
      await recognition.queries.deletion(
        memberScope(workspaceId),
        brandDocumentId(document.id),
      ),
    ).toEqual({ status: 'deleted' });
    await recognition.commands.remove(
      memberScope(workspaceId),
      brandDocumentId(document.id),
    );
    await rejected(
      recognition.commands.upload(
        memberScope(input.workspaceId, input.actorId),
        input,
      ),
      'IDEMPOTENCY_CONFLICT',
    );
    await rejected(
      recognition.queries.image(
        memberScope(workspaceId),
        brandDocumentId(document.id),
        0,
      ),
      'NOT_FOUND',
    );

    // A lost SQL lock must not let deletion overtake an active/unknown remote PUT.
    const second = await recognition.commands.upload(
      memberScope(input.workspaceId, input.actorId),
      { ...input, requestKey: crypto.randomUUID() },
    );
    const key = `results/${workspaceId}/${second.id}/late.json`;
    await registry.stage({
      key,
      workspaceId,
      documentId: second.id,
      kind: 'result',
      contentType: 'application/json',
      size: 1,
      checksum: '0'.repeat(64),
    });
    let release: () => void = () => undefined,
      started: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const lockKey = `document:${workspaceId}:${second.id}`;
    const outcome = locks
      .run(lockKey, (signal) =>
        createProcessingIo(db, uuidV7).run(
          { kind: 'document', workspaceId, documentId: second.id },
          async () => {
            started();
            await gate;
            expect(signal.aborted).toBe(true);
            files.set(key, new Uint8Array([1]));
            throw new StorageWriteOutcomeUnknown();
          },
        ),
      )
      .then(
        () => null,
        (error: unknown) => error,
      );
    await entered;
    const owners = await db.$queryRaw<
      { pid: number }[]
    >`SELECT pid FROM pg_locks WHERE locktype='advisory' AND classid=((hashtextextended(${lockKey},0)>>32)&4294967295)::oid AND objid=(hashtextextended(${lockKey},0)&4294967295)::oid`;
    const owner = owners[0];
    if (!owner) throw new Error('Lock owner missing');
    await db.$queryRaw`SELECT pg_terminate_backend(${owner.pid})`;
    await recognition.commands.remove(
      memberScope(workspaceId),
      brandDocumentId(second.id),
    );
    await cleanup();
    expect(
      (
        await recognition.queries.deletion(
          memberScope(workspaceId),
          brandDocumentId(second.id),
        )
      ).status,
    ).toBe('deleting');
    release();
    expect(await outcome).toBeInstanceOf(StorageWriteOutcomeUnknown);
    await cleanup();
    expect(
      (
        await recognition.queries.deletion(
          memberScope(workspaceId),
          brandDocumentId(second.id),
        )
      ).status,
    ).toBe('needs-recovery');
    const statuses = await recognition.queries.deletions(
      memberScope(workspaceId),
      [brandDocumentId(document.id), brandDocumentId(second.id)],
    );
    expect(
      new Map(statuses.map(({ documentId, status }) => [documentId, status])),
    ).toEqual(
      new Map([
        [document.id, 'deleted'],
        [second.id, 'needs-recovery'],
      ]),
    );
    expect(
      (
        await recognition.queries.pendingDeletions(memberScope(workspaceId))
      ).map(({ id, status }) => ({ id, status })),
    ).toEqual([{ id: second.id, status: 'needs-recovery' }]);
    expect(
      await recognition.queries.pendingDeletions(
        memberScope(crypto.randomUUID()),
      ),
    ).toEqual([]);
    expect(files.has(key)).toBe(true);
    // Simulated operator reconciliation AFTER the fake remote PUT has definitively settled.
    await db.processingIo.deleteMany({
      where: { workspaceId, documentId: second.id },
    });
    await cleanup();
    expect(files.size).toBe(0);
    expect(
      (
        await recognition.queries.deletion(
          memberScope(workspaceId),
          brandDocumentId(second.id),
        )
      ).status,
    ).toBe('deleted');
    expect(
      await recognition.queries.pendingDeletions(memberScope(workspaceId)),
    ).toEqual([]);
  } finally {
    await worker?.stop();
    await api.stop();
    await db.processingIo.deleteMany({ where: { workspaceId } });
    await db.documentArtifact.deleteMany({ where: { workspaceId } });
    await db.runAttempt.deleteMany({ where: { workspaceId } });
    await db.documentDeletion.deleteMany({ where: { workspaceId } });
    await db.resultUpload.deleteMany({ where: { workspaceId } });
    await db.sourceUpload.deleteMany({ where: { workspaceId } });
    await db.work.deleteMany({ where: { workspaceId } });
    await db.run.deleteMany({ where: { workspaceId } });
    await db.sourceDocument.deleteMany({ where: { workspaceId } });
    await db.auditEvent.deleteMany({ where: { workspaceId } });
    await db.anykoWorkspace.deleteMany({ where: { id: workspaceId } });
    await db.$disconnect();
    await pool.end();
  }
}, 30000);

test('unknown PUT remains a durable erasure barrier when updating processing failure also fails', async () => {
  const pool = createDatabasePool(databaseUrl);
  const db = createDatabase(pool);
  const workspaceId = crypto.randomUUID();
  const files = new Map<string, Uint8Array>();
  const calls = { failure: 0, erase: 0 };
  const storage: SourceStorage = {
    put(key, bytes) {
      if (key.startsWith('results/'))
        return Promise.reject(new StorageWriteOutcomeUnknown());
      files.set(key, bytes);
      return Promise.resolve();
    },
    get(key) {
      const bytes = files.get(key);
      if (!bytes) throw new Error('MISSING_FIXTURE');
      return Promise.resolve(bytes);
    },
    delete(key) {
      files.delete(key);
      return Promise.resolve();
    },
    exists: (key) => Promise.resolve(files.has(key)),
  };
  const api = startApi(storage);
  const recognition = api.documentHttp.documents;
  try {
    await db.anykoWorkspace.create({
      data: { id: workspaceId, name: 'Synthetic uncertain write' },
    });
    const document = await recognition.commands.upload(
      memberScope(workspaceId, 'fixture'),
      {
        filename: 'fixture.pdf',
        bytes: new TextEncoder().encode('%PDF-1.7 fixture'),
        requestKey: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
      },
    );
    const run = await db.run.findFirstOrThrow({
      where: { workspaceId, documentId: document.id },
    });
    const processing = createDocumentProcessingStore(db);
    const claimAttempt = claimDocumentAttempt({
      store: {
        ...processing,
        finish() {
          calls.failure++;
          return Promise.reject(new Error('STATUS_UPDATE_DOWN'));
        },
      },
      uow: createUnitOfWork(db),
      clock: { now: () => new Date() },
      newId: () => crypto.randomUUID(),
      leaseMs: 60_000,
    });
    const execute = createDocumentOcrWorkflow({
      processing,
      claimAttempt,
      storage,
      artifacts: createArtifactRegistry(db),
      logger,
      vision: {
        describe() {
          throw new Error('UNEXPECTED_VISION_CALL');
        },
      },
      connection() {
        throw new Error('UNEXPECTED_LLM_CONNECTION');
      },
      parser: {
        parseDocument: () =>
          Promise.resolve({
            markdown: 'Synthetic result',
            processorVersion: 'fixture',
          }),
        eraseAttempt() {
          calls.erase++;
          return Promise.resolve();
        },
      },
    });
    let caught: unknown;
    try {
      await createProcessingIo(db, uuidV7).run(
        { kind: 'document', workspaceId, documentId: document.id },
        () =>
          execute({ workspaceId, runId: run.id }, new AbortController().signal),
      );
    } catch (error) {
      caught = error;
    }
    expect(
      await db.processingIo.findMany({
        where: { workspaceId },
        select: { uncertain: true },
      }),
    ).toEqual([{ uncertain: true }]);
    expect(caught).toBeInstanceOf(StorageWriteOutcomeUnknown);
    expect(calls).toEqual({ failure: 1, erase: 1 });
    expect(
      (await db.run.findUniqueOrThrow({ where: { id: run.id } })).resultKey,
    ).toBeNull();
  } finally {
    await api.stop();
    await db.processingIo.deleteMany({ where: { workspaceId } });
    await db.documentArtifact.deleteMany({ where: { workspaceId } });
    await db.runAttempt.deleteMany({ where: { workspaceId } });
    await db.resultUpload.deleteMany({ where: { workspaceId } });
    await db.sourceUpload.deleteMany({ where: { workspaceId } });
    await db.run.deleteMany({ where: { workspaceId } });
    await db.sourceDocument.deleteMany({ where: { workspaceId } });
    await db.auditEvent.deleteMany({ where: { workspaceId } });
    await db.anykoWorkspace.deleteMany({ where: { id: workspaceId } });
    await db.$disconnect();
    await pool.end();
  }
});
