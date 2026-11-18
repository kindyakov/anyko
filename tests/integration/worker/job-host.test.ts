import { afterAll, expect, test } from 'bun:test';

import { z } from 'zod';

import { uuidV7 } from '@anyko/backend/ids';
import { defineJob } from '@anyko/backend/jobs';
import { createDatabase, createDatabasePool } from '@anyko/database';
import { createLogger } from '@anyko/logger';
import { startJobWorker } from '@anyko/worker/queues';
import { createQueueProbe } from '@anyko/worker/testing';

import { claimDocumentAttempt } from '../../../packages/backend/src/modules/processing';
import { createDocumentProcessingStore } from '../../../packages/backend/src/modules/processing/infrastructure/store';
import { systemClock } from '../../../packages/backend/src/platform/clock';
import { createBackend } from '../../../packages/backend/src/runtime';
import { createUnitOfWork } from '../../../packages/backend/src/runtime/transactions';
import { createWorkProcessing } from '../../../packages/backend/src/runtime/works/processing';

import { integrationConfig } from './support/composition';

const databaseUrl = process.env.TEST_DATABASE_URL;
const redisUrl = process.env.TEST_REDIS_URL;
if (
  !databaseUrl ||
  !/^\/anyko_test(?:_[a-z0-9_]+)?$/.test(new URL(databaseUrl).pathname) ||
  !redisUrl
)
  throw new Error('Dedicated anyko_test and TEST_REDIS_URL required');
const pool = createDatabasePool(databaseUrl);
const db = createDatabase(pool);
const logger = createLogger({
  service: 'worker',
  environment: 'test',
  release: 'job-host',
  level: 'fatal',
});
const backend = createBackend(integrationConfig({ databaseUrl, redisUrl }), {
  logger,
  role: 'worker',
});
const workspaceId = uuidV7();
await db.anykoWorkspace.create({
  data: { id: workspaceId, name: 'Job host integration' },
});
afterAll(async () => {
  await backend.stop();
  await db.run.deleteMany({ where: { workspaceId } });
  await db.sourceDocument.deleteMany({ where: { workspaceId } });
  await db.work.deleteMany({ where: { workspaceId } });
  await db.anykoWorkspace.delete({ where: { id: workspaceId } });
  await db.$disconnect();
  await pool.end();
});
async function fixture() {
  const documentId = uuidV7();
  const runId = uuidV7();
  const correlationId = uuidV7();
  await db.sourceDocument.create({
    data: {
      id: documentId,
      workspaceId,
      filename: 'test.pdf',
      sourceKey: `jobs/${documentId}.pdf`,
      sourceChecksum: 'fixture',
      requestKey: uuidV7(),
      size: 10,
      createdBy: 'test',
    },
  });
  await db.run.create({
    data: {
      id: runId,
      kind: 'document.ocr',
      revision: 1,
      workspaceId,
      documentId,
      correlationId,
      initiatedBy: 'test',
    },
  });
  return {
    envelopeVersion: 1,
    version: 1,
    workspaceId,
    runId,
    correlationId,
    payload: {},
  };
}
async function waitFor(check: () => Promise<boolean>) {
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await Bun.sleep(20);
  }
  throw new Error('JOB_TEST_TIMEOUT');
}

test('WORKER_QUEUES=ocr leaves llm delivery waiting and executes a current OCR envelope', async () => {
  const prefix = `queue-selection-${uuidV7()}`;
  const ocr = createQueueProbe(redisUrl, 'ocr', prefix);
  const llm = createQueueProbe(redisUrl, 'llm', prefix);
  let calls = 0;
  const job = defineJob({
    kind: 'run',
    connection: 'none',
    maxRunAttempts: null,
    redeliverQueued: false,
    name: 'document.ocr',
    version: 1,
    queue: 'ocr',
    payload: z.object({}).strict(),
    timeoutMs: 1000,
    retry: { attempts: 1, backoffMs: 0 },
    handler(scope) {
      expect(scope.workspaceId).toBe(workspaceId);
      calls++;
      return Promise.resolve();
    },
  });
  // An llm definition ensures an incorrectly broad subscription executes rather than merely rejects it.
  const llmJob = defineJob({
    kind: 'run',
    connection: 'none',
    maxRunAttempts: null,
    redeliverQueued: false,
    name: 'test.llm',
    version: 1,
    queue: 'llm',
    payload: z.object({}).strict(),
    timeoutMs: 1000,
    retry: { attempts: 1, backoffMs: 0 },
    handler() {
      calls += 100;
      return Promise.resolve();
    },
  });
  const data = await fixture();
  const runtime = {
    ...backend.jobs,
    delivery: {
      ...backend.jobs.delivery,
      reserve: () => Promise.resolve(null),
    },
    reconcile: () => Promise.resolve(),
    registry: {
      ...backend.jobs.registry,
      definitions: [job, llmJob],
      schedules: [],
    },
  };
  const worker = await startJobWorker(runtime, {
    queues: 'ocr',
    prefix,
  });
  try {
    const pending = await llm.queue.add('test.llm', data);
    const current = await ocr.queue.add('document.ocr', data);
    await waitFor(() => current.isCompleted());
    await Bun.sleep(150);
    expect(calls).toBe(1);
    expect(await pending.getState()).toBe('waiting');
  } finally {
    await worker.stop();
    await Promise.all([ocr.close(), llm.close()]);
  }
});

test('retired formats, missing runs, unknown versions and stale identity never invoke the handler', async () => {
  const prefix = `queue-validation-${uuidV7()}`;
  const probe = createQueueProbe(redisUrl, 'ocr', prefix);
  let calls = 0;
  const job = defineJob({
    kind: 'run',
    connection: 'none',
    maxRunAttempts: null,
    redeliverQueued: false,
    name: 'document.ocr',
    version: 1,
    queue: 'ocr',
    payload: z.object({}).strict(),
    timeoutMs: 1000,
    retry: { attempts: 1, backoffMs: 0 },
    handler() {
      calls++;
      return Promise.resolve();
    },
  });
  const data = await fixture();
  const worker = await startJobWorker(
    {
      ...backend.jobs,
      delivery: {
        ...backend.jobs.delivery,
        reserve: () => Promise.resolve(null),
      },
      reconcile: () => Promise.resolve(),
      registry: { ...backend.jobs.registry, definitions: [job], schedules: [] },
    },
    { queues: 'ocr', prefix },
  );
  try {
    for (const input of [
      { version: 1, workspaceId, runId: data.runId },
      { ...data, runId: uuidV7() },
      { ...data, version: 2 },
      { ...data, envelopeVersion: 2 },
      { ...data, correlationId: uuidV7() },
      { ...data, attemptId: uuidV7() },
    ]) {
      const queued = await probe.queue.add('document.ocr', input);
      await waitFor(async () => await queued.isFailed());
    }
    expect(calls).toBe(0);
    const current = await probe.queue.add('document.ocr', data);
    await waitFor(async () => await current.isCompleted());
    expect(calls).toBe(1);
  } finally {
    await worker.stop();
    await probe.close();
  }
});

test('two workers share one maintenance schedule and reject unknown scheduled versions', async () => {
  const prefix = `queue-schedule-${uuidV7()}`;
  const probe = createQueueProbe(redisUrl, 'maintenance', prefix);
  let calls = 0;
  const job = defineJob({
    kind: 'scheduled',
    name: 'test.cleanup',
    version: 1,
    queue: 'maintenance',
    payload: z.object({}).strict(),
    timeoutMs: 1000,
    retry: { attempts: 1, backoffMs: 0 },
    handler(context) {
      expect('workspaceId' in context).toBe(false);
      calls++;
      return Promise.resolve();
    },
  });
  const runtime = {
    ...backend.jobs,
    delivery: {
      ...backend.jobs.delivery,
      reserve: () => Promise.resolve(null),
    },
    reconcile: () => Promise.resolve(),
    registry: {
      ...backend.jobs.registry,
      definitions: [job],
      schedules: [{ name: job.name, everyMs: 60000 }],
    },
  };
  const first = await startJobWorker(runtime, {
    queues: 'maintenance',
    prefix,
  });
  const second = await startJobWorker(runtime, {
    queues: 'maintenance',
    prefix,
  });
  try {
    await waitFor(() => Promise.resolve(calls === 1));
    await Bun.sleep(150);
    expect(calls).toBe(1);
    expect(await probe.queue.getJobSchedulersCount()).toBe(1);
    const unknown = await probe.queue.add(job.name, {
      envelopeVersion: 1,
      version: 2,
      correlationId: uuidV7(),
      payload: {},
    });
    await waitFor(async () => await unknown.isFailed());
    expect(calls).toBe(1);
  } finally {
    await Promise.all([first.stop(), second.stop()]);
    await probe.close();
  }
});

const runKinds = [
  { name: 'document.ocr', queue: 'ocr' },
  { name: 'work.analysis', queue: 'llm' },
  { name: 'work.generation', queue: 'render' },
] as const;

test.each(runKinds)(
  '$name reopens expired leases, fences old attempts and executes repeated delivery once',
  async ({ name, queue }) => {
    const data =
      name === 'document.ocr'
        ? await fixture()
        : {
            envelopeVersion: 1,
            version: 1,
            workspaceId,
            runId: uuidV7(),
            correlationId: uuidV7(),
            payload: {},
          };
    if (name !== 'document.ocr') {
      const workId = uuidV7();
      await db.work.create({
        data: {
          id: workId,
          workspaceId,
          title: 'Run engine fixture',
          packageVersion: 'technical-document-v1',
          createdBy: 'test',
        },
      });
      await db.run.create({
        data: {
          id: data.runId,
          workspaceId,
          kind: name,
          workId,
          inputRevision: 0,
          documentIds: [],
          modelSnapshot: {},
          initiatedBy: 'test',
          correlationId: data.correlationId,
          generationId: name === 'work.generation' ? uuidV7() : null,
        },
      });
    }
    await db.runOutbox.create({
      data: {
        id: uuidV7(),
        workspaceId,
        runId: data.runId,
        deliveredAt: new Date(),
      },
    });
    const uow = createUnitOfWork(db);
    const claimOcr = claimDocumentAttempt({
      store: createDocumentProcessingStore(db),
      uow,
      clock: systemClock,
      newId: uuidV7,
      leaseMs: 60_000,
    });
    const { claimAttempt: claimWork } = createWorkProcessing(db, uow);
    const claim = async () => {
      if (name !== 'document.ocr') {
        const attempt = await claimWork(workspaceId, data.runId);
        return attempt && (() => attempt.finish({ status: 'succeeded' }));
      }
      const attempt = await claimOcr(workspaceId, data.runId);
      if (!attempt) return null;
      return () =>
        attempt.finish({
          status: 'succeeded',
          resultKey: `run-test/${data.runId}/${attempt.attemptId}.json`,
          processorVersion: 'fixture',
        });
    };
    const stale = await claim();
    if (!stale) throw new Error('FIRST_CLAIM_MISSING');
    const expired = await db.run.update({
      where: { id: data.runId },
      data: { leaseUntil: new Date(0) },
    });
    await backend.jobs.reconcile();
    expect(
      await db.run.findUniqueOrThrow({ where: { id: data.runId } }),
    ).toMatchObject({ status: 'queued', attemptToken: null, leaseUntil: null });
    expect(
      (await db.runOutbox.findUniqueOrThrow({ where: { runId: data.runId } }))
        .deliveredAt,
    ).toBeNull();
    const prefix = `run-engine-${uuidV7()}`;
    const probe = createQueueProbe(redisUrl, queue, prefix);
    const policy = backend.jobs.registry.definitions.find(
      (job) => job.kind === 'run' && job.name === name,
    );
    if (!policy || policy.kind !== 'run') throw new Error('RUN_POLICY_MISSING');
    let executions = 0;
    let staleAccepted: boolean | undefined;
    let freshAccepted: boolean | undefined;
    const definition = defineJob({
      ...policy,
      payload: z.object({}).strict(),
      async handler() {
        const finish = await claim();
        if (!finish) throw new Error('DUPLICATE_CLAIM');
        executions++;
        staleAccepted = await stale();
        freshAccepted = await finish();
      },
    });
    const runtime = {
      ...backend.jobs,
      delivery: {
        ...backend.jobs.delivery,
        reserve: () => Promise.resolve(null),
      },
      registry: {
        ...backend.jobs.registry,
        definitions: [definition],
        schedules: [],
      },
    };
    const worker = await startJobWorker(runtime, {
      queues: queue,
      prefix,
    });
    try {
      const first = await probe.queue.add(name, data);
      await waitFor(() => first.isCompleted());
      const replay = await probe.queue.add(name, data);
      await waitFor(() => replay.isFailed());
      expect(executions).toBe(1);
      expect(staleAccepted).toBe(false);
      expect(freshAccepted).toBe(true);
      const run = await db.run.findUniqueOrThrow({ where: { id: data.runId } });
      expect(run).toMatchObject({
        status: 'succeeded',
        attempts: expired.attempts + 1,
        attemptToken: null,
      });
      expect(
        await db.runAttempt.count({
          where: { workspaceId, runId: data.runId },
        }),
      ).toBe(2);
    } finally {
      await worker.stop();
      await probe.close();
    }
  },
);
