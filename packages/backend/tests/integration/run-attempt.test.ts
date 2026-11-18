import { afterAll, expect, test } from 'bun:test';

import { createDatabase, createDatabasePool } from '@anyko/database';

import {
  claimDocumentAttempt,
  documentOcrPolicy,
} from '../../src/modules/processing';
import { recoverRuns } from '../../src/modules/processing/infrastructure/run-engine';
import { createDocumentProcessingStore } from '../../src/modules/processing/infrastructure/store';
import { worksStoreFor } from '../../src/modules/works/infrastructure/store';
import { brandWorkId, uuidV7 } from '../../src/platform/ids';
import { createUnitOfWork } from '../../src/runtime/transactions';
import { createWorkProcessing } from '../../src/runtime/works/processing';
import { memberScope } from '../support/scope';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (
  !databaseUrl ||
  !/^\/anyko_test(?:_[a-z0-9_]+)?$/.test(new URL(databaseUrl).pathname)
)
  throw new Error('Dedicated anyko_test TEST_DATABASE_URL required');
const pool = createDatabasePool(databaseUrl);
const db = createDatabase(pool);
const uow = createUnitOfWork(db);
const processing = createWorkProcessing(db, uow);
const owned: string[] = [];
const policy = {
  name: 'work.analysis',
  maxRunAttempts: null,
  redeliverQueued: false,
};

async function fixture() {
  const workspaceId = uuidV7();
  owned.push(workspaceId);
  await db.anykoWorkspace.create({
    data: { id: workspaceId, name: 'Attempt fixture' },
  });
  const workId = brandWorkId(uuidV7());
  await db.work.create({
    data: {
      id: workId,
      workspaceId,
      title: 'Synthetic work',
      packageVersion: 'technical-document-v1',
      createdBy: 'fixture',
    },
  });
  await processing.commands.start(memberScope(workspaceId), {
    workId,
    kind: 'analysis',
    inputRevision: 0,
    documentIds: [],
    settingsRevision: 1,
    generationId: null,
    correlationId: uuidV7(),
    modelSnapshot: { vision: 'fixture', extraction: 'fixture' },
  });
  const { id: runId } = await db.run.findFirstOrThrow({
    where: { workspaceId, workId },
  });
  return { workspaceId, workId, runId };
}

async function failureOf(operation: Promise<unknown>): Promise<unknown> {
  try {
    await operation;
  } catch (error) {
    return error;
  }
}

afterAll(async () => {
  const where = { workspaceId: { in: owned } };
  await db.resultUpload.deleteMany({ where });
  await db.run.deleteMany({ where });
  await db.runAttempt.deleteMany({ where });
  await db.sourceDocument.deleteMany({ where });
  await db.work.deleteMany({ where });
  await db.anykoWorkspace.deleteMany({ where: { id: { in: owned } } });
  await db.$disconnect();
  await pool.end();
});

test('the OCR attempt rolls back failed notifications and fences publication after lease expiry or replacement', async () => {
  const workspaceId = uuidV7();
  owned.push(workspaceId);
  await db.anykoWorkspace.create({
    data: { id: workspaceId, name: 'OCR attempt fixture' },
  });
  const documentId = uuidV7();
  const sourceKey = `sources/${workspaceId}/${documentId}.pdf`;
  await db.sourceDocument.create({
    data: {
      id: documentId,
      workspaceId,
      filename: 'fixture.pdf',
      sourceKey,
      sourceChecksum: '0'.repeat(64),
      size: 1,
      requestKey: uuidV7(),
      createdBy: 'fixture',
    },
  });
  const runId = uuidV7();
  const correlationId = uuidV7();
  await db.run.create({
    data: {
      id: runId,
      workspaceId,
      documentId,
      revision: 1,
      kind: documentOcrPolicy.name,
      initiatedBy: 'fixture',
      correlationId,
      outbox: { create: { id: uuidV7(), deliveredAt: new Date() } },
    },
  });
  let now = new Date();
  const clock = { now: () => now };
  let rejectNotification = true;
  const store = createDocumentProcessingStore(
    db,
    () =>
      rejectNotification
        ? Promise.reject(new Error('WORK_EVENT_FAILED'))
        : Promise.resolve(),
    clock,
  );
  const claim = claimDocumentAttempt({
    store,
    uow,
    clock,
    newId: uuidV7,
    leaseMs: 60_000,
  });
  const load = () => db.run.findUniqueOrThrow({ where: { id: runId } });
  const countAttempts = () => db.runAttempt.count({ where: { runId } });
  expect(await failureOf(claim(workspaceId, runId))).toMatchObject({
    message: 'WORK_EVENT_FAILED',
  });
  expect(await load()).toMatchObject({ status: 'queued', attempts: 0 });
  expect(await countAttempts()).toBe(0);

  rejectNotification = false;
  const old = await claim(workspaceId, runId);
  if (!old) throw new Error('CLAIM_MISSING');
  expect(old.run).toEqual({
    id: runId,
    workspaceId,
    documentId,
    sourceKey,
    correlationId,
  });
  const expires = now.getTime() + 60_000;
  expect(await load()).toMatchObject({
    status: 'running',
    leaseUntil: new Date(expires),
    attemptToken: old.attemptId,
  });
  now = new Date(expires);
  const stale = {
    status: 'succeeded',
    resultKey: 'results/old-fixture',
    processorVersion: 'fixture',
  } as const;
  expect(await old.finish(stale)).toBe(false);
  expect(await load()).toMatchObject({ status: 'running', resultKey: null });

  now = new Date(expires + 1);
  await db.$transaction((tx) => recoverRuns(tx, [documentOcrPolicy], now));
  const fresh = await claim(workspaceId, runId);
  if (!fresh) throw new Error('RECLAIM_MISSING');
  expect(await old.finish(stale)).toBe(false);
  expect(await old.finish({ status: 'failed', errorCode: 'STALE_ERROR' })).toBe(
    false,
  );
  expect(await countAttempts()).toBe(2);

  const resultKey = `results/${workspaceId}/${fresh.attemptId}.json`;
  await store.stageResult(resultKey, workspaceId);
  const success = {
    status: 'succeeded',
    resultKey,
    processorVersion: 'fixture',
  } as const;
  rejectNotification = true;
  expect(await failureOf(fresh.finish(success))).toMatchObject({
    message: 'WORK_EVENT_FAILED',
  });
  expect(await load()).toMatchObject({
    status: 'running',
    resultKey: null,
    errorCode: null,
  });
  expect(await db.resultUpload.count({ where: { key: resultKey } })).toBe(1);

  rejectNotification = false;
  expect(await fresh.finish(success)).toBe(true);
  expect(
    await fresh.finish({ ...success, resultKey: 'results/duplicate-fixture' }),
  ).toBe(false);
  expect(await db.resultUpload.count({ where: { key: resultKey } })).toBe(0);
  expect(await load()).toMatchObject({
    status: 'succeeded',
    resultKey,
    processorVersion: 'fixture',
    leaseUntil: null,
    attemptToken: null,
  });
  expect(
    await failureOf(
      db.run.update({ where: { id: runId }, data: { status: 'unrecognised' } }),
    ),
  ).toBeInstanceOf(Error);
});

test('the attempt commits the step, work change and outcome together', async () => {
  const { workspaceId, workId, runId } = await fixture();
  const claims = await Promise.all([
    processing.claimAttempt(workspaceId, runId),
    processing.claimAttempt(workspaceId, runId),
  ]);
  expect(claims.filter(Boolean)).toHaveLength(1);
  const attempt = claims.find((entry) => entry !== null);
  if (!attempt) throw new Error('CLAIM_MISSING');
  expect(attempt.run).toMatchObject({
    workspaceId,
    workId,
    id: runId,
    kind: 'analysis',
  });
  expect(attempt.run).not.toHaveProperty('attemptToken');
  expect(attempt.run).not.toHaveProperty('leaseUntil');

  const cancellation = new AbortController();
  const lost = new Error('RESOURCE_LOCK_LOST');
  const save = (mode: 'error' | 'abort' | 'success') =>
    attempt.write(
      async (tx, active) => {
        await worksStoreFor(tx).touch(workspaceId, workId, {
          expectedRevision: 0,
        });
        await active.step({ stage: 'reconciliation', status: 'succeeded' });
        await active.finish({ status: 'succeeded' });
        if (mode === 'error') throw new Error('SYNTHETIC_FAILURE');
        if (mode === 'abort') cancellation.abort(lost);
      },
      mode === 'abort' ? cancellation.signal : undefined,
    );
  const where = { workspaceId, runId };
  const revision = async () =>
    (await db.work.findUniqueOrThrow({ where: { id: workId } })).revision;
  expect(await failureOf(save('error'))).toMatchObject({
    message: 'SYNTHETIC_FAILURE',
  });
  expect(await failureOf(save('abort'))).toBe(lost);
  expect(await revision()).toBe(0);
  expect(await db.runStep.count({ where })).toBe(0);
  expect(
    await db.run.findUniqueOrThrow({ where: { id: runId } }),
  ).toMatchObject({ status: 'running' });

  await save('success');
  expect(await revision()).toBe(1);
  expect(await db.runStep.findFirstOrThrow({ where })).toMatchObject({
    stage: 'reconciliation',
    status: 'succeeded',
  });
  expect(
    await db.run.findUniqueOrThrow({ where: { id: runId } }),
  ).toMatchObject({
    status: 'succeeded',
    attempts: 1,
    attemptToken: null,
    leaseUntil: null,
  });
});

test('lease recovery reopens delivery and leaves the old handle unable to write or finish', async () => {
  const { workspaceId, workId, runId } = await fixture();
  const old = await processing.claimAttempt(workspaceId, runId);
  if (!old) throw new Error('CLAIM_MISSING');
  await old.step({ stage: 'extraction', status: 'running' });
  const now = new Date();
  const stale = { message: 'STALE_WORK_ATTEMPT' };
  await db.runOutbox.update({ where: { runId }, data: { deliveredAt: now } });
  await db.run.update({
    where: { id: runId },
    data: { leaseUntil: new Date(0) },
  });
  expect(await failureOf(old.assertCurrent())).toMatchObject(stale);

  await db.$transaction((tx) => recoverRuns(tx, [policy], now));
  expect(
    await db.runOutbox.findUniqueOrThrow({ where: { runId } }),
  ).toMatchObject({ deliveredAt: null });
  const fresh = await processing.claimAttempt(workspaceId, runId);
  if (!fresh) throw new Error('RECLAIM_MISSING');
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL TIME ZONE 'Europe/Moscow'`;
    await recoverRuns(tx, [policy], new Date());
  });
  await fresh.assertCurrent();

  const touch = (tx: Parameters<typeof worksStoreFor>[0]) =>
    worksStoreFor(tx).touch(workspaceId, workId, {});
  expect(await failureOf(old.write(touch))).toMatchObject(stale);
  expect(
    await failureOf(old.step({ stage: 'extraction', status: 'succeeded' })),
  ).toMatchObject(stale);
  expect(await old.finish({ status: 'succeeded' }, touch)).toBe(false);
  expect(
    await db.work.findUniqueOrThrow({ where: { id: workId } }),
  ).toMatchObject({ revision: 0 });
  expect(
    await db.runStep.findFirstOrThrow({ where: { workspaceId, runId } }),
  ).toMatchObject({
    stage: 'extraction',
    status: 'running',
  });

  expect(
    await fresh.finish(
      { status: 'failed', errorCode: 'FIXTURE_FAILURE' },
      touch,
    ),
  ).toBe(true);
  expect(
    await db.work.findUniqueOrThrow({ where: { id: workId } }),
  ).toMatchObject({ revision: 1 });
  expect(
    await db.run.findUniqueOrThrow({ where: { id: runId } }),
  ).toMatchObject({
    status: 'failed',
    errorCode: 'FIXTURE_FAILURE',
    attempts: 2,
    attemptToken: null,
    leaseUntil: null,
  });
});
