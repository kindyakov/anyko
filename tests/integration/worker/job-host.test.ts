import { afterAll, expect, test } from 'bun:test';

import { z } from 'zod';

import { uuidV7 } from '@anyko/backend/ids';
import { defineJob } from '@anyko/backend/jobs';
import { createDatabase, createDatabasePool } from '@anyko/database';
import { createLogger } from '@anyko/logger';
import { startJobWorker } from '@anyko/worker/queues';
import { createQueueProbe } from '@anyko/worker/testing';

import { createBackend } from '../../../packages/backend/src/runtime';

import { integrationConfig } from './support/composition';

const databaseUrl = process.env.TEST_DATABASE_URL;
const redisUrl = process.env.TEST_REDIS_URL;
if (
  !databaseUrl ||
  new URL(databaseUrl).pathname !== '/anyko_test' ||
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
  await db.processingRun.deleteMany({ where: { workspaceId } });
  await db.sourceDocument.deleteMany({ where: { workspaceId } });
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
  await db.processingRun.create({
    data: {
      id: runId,
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

test('WORKER_QUEUES=ocr leaves llm delivery waiting and executes a legacy OCR envelope', async () => {
  const prefix = `queue-selection-${uuidV7()}`;
  const ocr = createQueueProbe(redisUrl, 'ocr', prefix);
  const llm = createQueueProbe(redisUrl, 'llm', prefix);
  let calls = 0;
  const job = defineJob({
    kind: 'run',
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
    deliveries: [],
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
    legacy: false,
  });
  try {
    const pending = await llm.queue.add('test.llm', data);
    const old = await ocr.queue.add('document.ocr', {
      version: 1,
      workspaceId,
      runId: data.runId,
    });
    await waitFor(async () => await old.isCompleted());
    await Bun.sleep(150);
    expect(calls).toBe(1);
    expect(await pending.getState()).toBe('waiting');
  } finally {
    await worker.stop();
    await Promise.all([ocr.close(), llm.close()]);
  }
});

test('unknown envelope/job versions, correlation mismatch and stale attempt never invoke the handler', async () => {
  const prefix = `queue-validation-${uuidV7()}`;
  const probe = createQueueProbe(redisUrl, 'ocr', prefix);
  let calls = 0;
  const job = defineJob({
    kind: 'run',
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
      deliveries: [],
      reconcile: () => Promise.resolve(),
      registry: { ...backend.jobs.registry, definitions: [job], schedules: [] },
    },
    { queues: 'ocr', prefix, legacy: false },
  );
  try {
    for (const input of [
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
    deliveries: [],
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
    legacy: false,
  });
  const second = await startJobWorker(runtime, {
    queues: 'maintenance',
    prefix,
    legacy: false,
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

test('rollout bridge drains the old OCR queue through the persisted run into its workload queue', async () => {
  const old = createQueueProbe(redisUrl, 'anyko-document-ocr', 'bull');
  const target = createQueueProbe(redisUrl, 'ocr', 'bull');
  const data = await fixture();
  let calls = 0;
  const job = defineJob({
    kind: 'run',
    name: 'document.ocr',
    version: 1,
    queue: 'ocr',
    payload: z.object({}).strict(),
    timeoutMs: 1000,
    retry: { attempts: 1, backoffMs: 0 },
    handler(scope) {
      expect(scope.correlationId).toBe(data.correlationId);
      calls++;
      return Promise.resolve();
    },
  });
  const worker = await startJobWorker(
    {
      ...backend.jobs,
      deliveries: backend.jobs.deliveries.map((port) => ({
        ...port,
        reserve: () => Promise.resolve(null),
      })),
      reconcile: () => Promise.resolve(),
      registry: { ...backend.jobs.registry, definitions: [job], schedules: [] },
    },
    { queues: 'ocr' },
  );
  try {
    await old.queue.add('document.ocr', {
      version: 1,
      workspaceId,
      runId: data.runId,
    });
    await waitFor(() => Promise.resolve(calls === 1));
    expect(calls).toBe(1);
  } finally {
    await worker.stop();
    await Promise.all([old.close(), target.close()]);
  }
});
