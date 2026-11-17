import { expect, test } from 'bun:test';

import { createJobProcessing, type SavedJobRun } from './job-scope';

const run: SavedJobRun = {
  workspaceId: 'local',
  runId: '01900000-0000-7000-8000-000000000001',
  correlationId: '01900000-0000-7000-8000-000000000002',
  jobName: 'work.analysis',
  status: 'queued',
  attemptToken: null,
};

test('processing issues scope from the saved run and validates the current envelope', async () => {
  const processing = createJobProcessing({ read: () => Promise.resolve(run) });
  const scope = await processing.internal.scope(
    {
      envelopeVersion: 1,
      correlationId: run.correlationId,
      version: 1,
      workspaceId: run.workspaceId,
      runId: run.runId,
      payload: {},
    },
    'work.analysis',
  );
  expect(scope).toMatchObject({
    workspaceId: run.workspaceId,
    correlationId: run.correlationId,
  });
  expect(Object.isFrozen(scope)).toBe(true);
});

test('mismatched correlation, wrong job, stale attempt and already claimed runs receive no scope', async () => {
  let saved = run;
  const processing = createJobProcessing({
    read: () => Promise.resolve(saved),
  });
  const envelope = {
    envelopeVersion: 1,
    version: 1,
    workspaceId: run.workspaceId,
    runId: run.runId,
    correlationId: run.correlationId,
    payload: {},
  } as const;
  expect(
    await processing.internal.scope(
      { ...envelope, correlationId: 'other' },
      'work.analysis',
    ),
  ).toBeNull();
  expect(
    await processing.internal.scope(envelope, 'work.generation'),
  ).toBeNull();
  expect(
    await processing.internal.scope(
      { ...envelope, attemptId: 'stale' },
      'work.analysis',
    ),
  ).toBeNull();
  saved = { ...run, status: 'running', attemptToken: 'claimed' };
  expect(await processing.internal.scope(envelope, 'work.analysis')).toBeNull();
});
