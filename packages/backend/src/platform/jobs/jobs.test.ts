import { expect, test } from 'bun:test';

import { z } from 'zod';

import { defineJob, parseJobEnvelope, parseWorkerQueues } from '.';

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
    version: 1,
    queue: 'ocr',
    payload: z.object({}).strict(),
    timeoutMs: 100,
    retry: { attempts: 1, backoffMs: 0 },
    async handler(_scope: string) {
      calls++;
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
    await expect(
      (async () => {
        const envelope = parseJobEnvelope(input, job.version);
        await job.execute(
          'trusted',
          envelope.payload,
          new AbortController().signal,
        );
      })(),
    ).rejects.toThrow();
  }
  expect(calls).toBe(0);
});

test('payload schema transforms and validates before execution', async () => {
  const seen: number[] = [];
  const job = defineJob({
    name: 'test',
    version: 1,
    queue: 'llm',
    payload: z.object({ value: z.string().transform(Number) }),
    timeoutMs: 100,
    retry: { attempts: 1, backoffMs: 0 },
    async handler(_scope: string, payload) {
      seen.push(payload.value);
    },
  });
  await job.execute('trusted', { value: '42' }, new AbortController().signal);
  expect(seen).toEqual([42]);
  expect(() =>
    job.execute('trusted', { value: null }, new AbortController().signal),
  ).toThrow();
  expect(seen).toEqual([42]);
});

test('queue selection defaults to all, deduplicates and rejects unknown or empty names', () => {
  expect(parseWorkerQueues()).toEqual(['ocr', 'llm', 'render', 'maintenance']);
  expect(parseWorkerQueues(' ocr,ocr, llm ')).toEqual(['ocr', 'llm']);
  for (const value of ['', 'ocr,', 'other'])
    expect(() => parseWorkerQueues(value)).toThrow();
});
