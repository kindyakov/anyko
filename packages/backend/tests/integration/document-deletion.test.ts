import { expect, test } from 'bun:test';
import { createDatabase, createResourceLocks } from '@anyko/database';
import { createLogger } from '@anyko/logger';
import { createDocumentRuntime } from '../../src/runtime/documents/api';
import { createDocumentWorker } from '../../src/runtime/documents/worker';
import { finishDocumentDeletion } from '../../src/runtime/documents/unit-of-work';
import { createProcessingStore } from '../../src/modules/processing/infrastructure/store';
import { createDeletionStore } from '../../src/modules/documents/infrastructure/deletion-store';
import { createDocumentIo } from '../../src/modules/documents/infrastructure/document-io';
import { createArtifactRegistry } from '../../src/modules/documents/infrastructure/artifact-store';
import { createDocumentDeletionWorkflow } from '../../src/workflows/document-deletion';
import { createDocumentOcrWorkflow } from '../../src/workflows/document-ocr';
import { createProcessingService } from '../../src/modules/processing';
import {
  StorageWriteOutcomeUnknown,
  type SourceStorage,
} from '../../src/modules/documents';
const databaseUrl = process.env.TEST_DATABASE_URL,
  redisUrl = process.env.TEST_REDIS_URL;
if (
  !databaseUrl ||
  new URL(databaseUrl).pathname !== '/anyko_test' ||
  !redisUrl
)
  throw new Error('Dedicated test services required');
const logger = createLogger({
  service: 'worker',
  environment: 'test',
  release: 'erasure-test',
  level: 'fatal',
});
async function rejected(operation: Promise<unknown>, code: string) {
  let caught: unknown;
  try {
    await operation;
  } catch (error) {
    caught = error;
  }
  expect(String(caught)).toContain(code);
}

test('separate images and all document data are physically erased; unknown/active writers block completion', async () => {
  const db = createDatabase(databaseUrl),
    locks = createResourceLocks(databaseUrl);
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
  const runtime = createDocumentRuntime({ databaseUrl, storage, logger });
  const processing = createProcessingStore(db),
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
    finish: (scope, id, keys) => finishDocumentDeletion(db, scope, id, keys),
    locks,
    storage,
    logger,
  });
  let worker: Awaited<ReturnType<typeof createDocumentWorker>> | undefined;
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
    const document = await runtime.upload(input);
    worker = await createDocumentWorker({
      databaseUrl,
      redisUrl,
      storage,
      logger,
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
      (await runtime.get({ workspaceId, documentId: document.id })).status !==
      'succeeded'
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
      await runtime.image({ workspaceId, documentId: document.id, index: 0 }),
    ).toEqual({ bytes: png, contentType: 'image/png' });
    await rejected(
      runtime.remove({
        workspaceId: crypto.randomUUID(),
        documentId: document.id,
      }),
      'NOT_FOUND',
    );
    await runtime.remove({ workspaceId, documentId: document.id });
    failures.processor = true;
    await cleanup();
    expect(
      (await runtime.deletion({ workspaceId, documentId: document.id })).status,
    ).toBe('deleting');
    expect(files.size).toBe(3);
    failures.processor = false;
    failures.storage = true;
    await cleanup();
    expect(
      (await runtime.deletion({ workspaceId, documentId: document.id })).status,
    ).toBe('deleting');
    failures.storage = false;
    await cleanup();
    expect(files.size).toBe(0);
    expect(erased.size).toBeGreaterThan(0);
    expect(await db.sourceDocument.count({ where: { workspaceId } })).toBe(0);
    expect(await db.processingRun.count({ where: { workspaceId } })).toBe(0);
    expect(await db.documentArtifact.count({ where: { workspaceId } })).toBe(0);
    expect(await db.processorAttempt.count({ where: { workspaceId } })).toBe(0);
    expect(
      await runtime.deletion({ workspaceId, documentId: document.id }),
    ).toEqual({ status: 'deleted' });
    await runtime.remove({ workspaceId, documentId: document.id });
    await rejected(runtime.upload(input), 'IDEMPOTENCY_CONFLICT');
    await rejected(
      runtime.image({ workspaceId, documentId: document.id, index: 0 }),
      'NOT_FOUND',
    );

    // A lost SQL lock must not let deletion overtake an active/unknown remote PUT.
    const second = await runtime.upload({
      ...input,
      requestKey: crypto.randomUUID(),
    });
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
        createDocumentIo(db).run(
          { workspaceId, documentId: second.id },
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
    await runtime.remove({ workspaceId, documentId: second.id });
    await cleanup();
    expect(
      (await runtime.deletion({ workspaceId, documentId: second.id })).status,
    ).toBe('deleting');
    release();
    expect(await outcome).toBeInstanceOf(StorageWriteOutcomeUnknown);
    await cleanup();
    expect(
      (await runtime.deletion({ workspaceId, documentId: second.id })).status,
    ).toBe('needs-recovery');
    expect(
      (await runtime.pendingDeletions({ workspaceId })).map(
        ({ id, status }) => ({ id, status }),
      ),
    ).toEqual([{ id: second.id, status: 'needs-recovery' }]);
    expect(
      await runtime.pendingDeletions({ workspaceId: crypto.randomUUID() }),
    ).toEqual([]);
    expect(files.has(key)).toBe(true);
    // Simulated operator reconciliation AFTER the fake remote PUT has definitively settled.
    await db.documentIo.deleteMany({
      where: { workspaceId, documentId: second.id },
    });
    await cleanup();
    expect(files.size).toBe(0);
    expect(
      (await runtime.deletion({ workspaceId, documentId: second.id })).status,
    ).toBe('deleted');
    expect(await runtime.pendingDeletions({ workspaceId })).toEqual([]);
  } finally {
    await worker?.stop();
    await runtime.stop();
    await locks.stop();
    await db.documentIo.deleteMany({ where: { workspaceId } });
    await db.documentArtifact.deleteMany({ where: { workspaceId } });
    await db.processorAttempt.deleteMany({ where: { workspaceId } });
    await db.documentDeletion.deleteMany({ where: { workspaceId } });
    await db.resultUpload.deleteMany({ where: { workspaceId } });
    await db.sourceUpload.deleteMany({ where: { workspaceId } });
    await db.processingRun.deleteMany({ where: { workspaceId } });
    await db.sourceDocument.deleteMany({ where: { workspaceId } });
    await db.anykoWorkspace.deleteMany({ where: { id: workspaceId } });
    await db.$disconnect();
  }
}, 30000);

test('unknown PUT remains a durable erasure barrier when updating processing failure also fails', async () => {
  const db = createDatabase(databaseUrl);
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
  const runtime = createDocumentRuntime({ databaseUrl, storage, logger });
  try {
    await db.anykoWorkspace.create({
      data: { id: workspaceId, name: 'Synthetic uncertain write' },
    });
    const document = await runtime.upload({
      workspaceId,
      actorId: 'fixture',
      filename: 'fixture.pdf',
      bytes: new TextEncoder().encode('%PDF-1.7 fixture'),
      requestKey: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
    });
    const run = await db.processingRun.findFirstOrThrow({
      where: { workspaceId, documentId: document.id },
    });
    const processing = createProcessingService({
      ...createProcessingStore(db),
      fail() {
        calls.failure++;
        return Promise.reject(new Error('STATUS_UPDATE_DOWN'));
      },
    });
    const execute = createDocumentOcrWorkflow({
      processing,
      storage,
      artifacts: createArtifactRegistry(db),
      logger,
      leaseMs: 60000,
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
      await createDocumentIo(db).run(
        { workspaceId, documentId: document.id },
        () =>
          execute({ workspaceId, runId: run.id }, new AbortController().signal),
      );
    } catch (error) {
      caught = error;
    }
    expect(
      await db.documentIo.findMany({
        where: { workspaceId },
        select: { uncertain: true },
      }),
    ).toEqual([{ uncertain: true }]);
    expect(caught).toBeInstanceOf(StorageWriteOutcomeUnknown);
    expect(calls).toEqual({ failure: 1, erase: 1 });
    expect(
      (await db.processingRun.findUniqueOrThrow({ where: { id: run.id } }))
        .resultKey,
    ).toBeNull();
  } finally {
    await runtime.stop();
    await db.documentIo.deleteMany({ where: { workspaceId } });
    await db.documentArtifact.deleteMany({ where: { workspaceId } });
    await db.processorAttempt.deleteMany({ where: { workspaceId } });
    await db.resultUpload.deleteMany({ where: { workspaceId } });
    await db.sourceUpload.deleteMany({ where: { workspaceId } });
    await db.processingRun.deleteMany({ where: { workspaceId } });
    await db.sourceDocument.deleteMany({ where: { workspaceId } });
    await db.anykoWorkspace.deleteMany({ where: { id: workspaceId } });
    await db.$disconnect();
  }
});
