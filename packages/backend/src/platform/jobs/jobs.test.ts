import { expect, test } from 'bun:test';

import { z } from 'zod';

import { createLogger } from '@anyko/logger';

import { systemClock } from '../clock';

import { defineJob, parseJobEnvelope, parseWorkerQueues } from '.';

const context = {
  clock: systemClock,
  logger: createLogger({
    service: 'worker',
    environment: 'test',
    release: 'jobs',
    level: 'fatal',
  }),
  signal: new AbortController().signal,
  correlationId: '01900000-0000-7000-8000-000000000002',
};
const runId = '01900000-0000-7000-8000-000000000001';
const correlationId = '01900000-0000-7000-8000-000000000002';

test('one parser reads the rollout legacy envelope and the current envelope', () => {
  expect(
    parseJobEnvelope({ version: 1, workspaceId: 'local', runId }, 1),
  ).toEqual({
    format: 'legacy',
    version: 1,
    workspaceId: 'local',
    runId,
    payload: {},
  });
  expect(
    parseJobEnvelope(
      {
        envelopeVersion: 1,
        version: 2,
        workspaceId: 'local',
        runId,
        correlationId,
        payload: { count: 2 },
      },
      2,
    ),
  ).toMatchObject({
    format: 'current',
    correlationId,
    payload: { count: 2 },
  });
});

test('unknown envelope and job versions cannot reach a handler', async () => {
  let calls = 0;
  const job = defineJob({
    name: 'test',
    kind: 'scheduled',
    version: 1,
    queue: 'maintenance',
    payload: z.object({}).strict(),
    timeoutMs: 100,
    retry: { attempts: 1, backoffMs: 0 },
    handler() {
      calls++;
      return Promise.resolve();
    },
  });
  for (const input of [
    { version: 2, workspaceId: 'local', runId },
    {
      envelopeVersion: 2,
      version: 1,
      workspaceId: 'local',
      runId,
      correlationId,
      payload: {},
    },
    {
      envelopeVersion: 1,
      version: 2,
      workspaceId: 'local',
      runId,
      correlationId,
      payload: {},
    },
  ]) {
    let rejected = false;
    try {
      const envelope = parseJobEnvelope(input, job.version);
      await job.execute(
        context,
        envelope.payload,
        new AbortController().signal,
      );
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
  }
  expect(calls).toBe(0);
});

test('payload schema transforms and validates before execution', async () => {
  const seen: number[] = [];
  const job = defineJob({
    name: 'test',
    kind: 'scheduled',
    version: 1,
    queue: 'maintenance',
    payload: z.object({ value: z.string().transform(Number) }),
    timeoutMs: 100,
    retry: { attempts: 1, backoffMs: 0 },
    handler(_scope, payload) {
      seen.push(payload.value);
      return Promise.resolve();
    },
  });
  await job.execute(context, { value: '42' }, new AbortController().signal);
  expect(seen).toEqual([42]);
  expect(() =>
    job.execute(context, { value: null }, new AbortController().signal),
  ).toThrow();
  expect(seen).toEqual([42]);
});

test('queue selection defaults to all, deduplicates and rejects unknown or empty names', () => {
  expect(parseWorkerQueues()).toEqual(['ocr', 'llm', 'render', 'maintenance']);
  expect(parseWorkerQueues(' ocr,ocr, llm ')).toEqual(['ocr', 'llm']);
  for (const value of ['', 'ocr,', 'other'])
    expect(() => parseWorkerQueues(value)).toThrow();
});

test('scheduled envelope versions reject before the handler and carry no run scope', async () => {
  let calls = 0;
  const job = defineJob({
    kind: 'scheduled',
    name: 'maintenance.test',
    version: 1,
    queue: 'maintenance',
    payload: z.object({}).strict(),
    timeoutMs: 100,
    retry: { attempts: 1, backoffMs: 0 },
    handler(ctx) {
      expect('workspaceId' in ctx).toBe(false);
      calls++;
      return Promise.resolve();
    },
  });
  const data = { envelopeVersion: 1, version: 1, correlationId, payload: {} };
  for (const input of [
    { ...data, version: 2 },
    { ...data, envelopeVersion: 2 },
  ]) {
    let rejected = false;
    try {
      const parsed = parseJobEnvelope(input, job.version, 'scheduled');
      await job.execute(context, parsed.payload, context.signal);
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
  }
  expect(calls).toBe(0);
  const parsed = parseJobEnvelope(data, job.version, 'scheduled');
  await job.execute(context, parsed.payload, context.signal);
  expect(calls).toBe(1);
});
