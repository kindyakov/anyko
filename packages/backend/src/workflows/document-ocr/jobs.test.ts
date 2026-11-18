import { expect, mock, test } from 'bun:test';

import { createJobProcessing } from '../../modules/processing';

import { documentOcrJob } from './jobs';

const envelope = {
  envelopeVersion: 1,
  version: 1,
  workspaceId: 'test-workspace',
  runId: '01900000-0000-7000-8000-000000000001',
  correlationId: '01900000-0000-7000-8000-000000000002',
  payload: {},
} as const;
const documentId = '01900000-0000-7000-8000-000000000003';

async function setup() {
  const processing = createJobProcessing({
    read: () =>
      Promise.resolve({
        ...envelope,
        jobName: 'document.ocr',
        status: 'queued',
        attemptToken: null,
      }),
  });
  const scope = await processing.internal.scope(envelope, 'document.ocr');
  if (!scope) throw new Error('EXPECTED_DOCUMENT_OCR_SCOPE');
  return scope;
}

test.each(['queue', 'lock'] as const)(
  'OCR runs inside the document lock and write barrier and observes %s cancellation',
  async (cancelledBy) => {
    const scope = await setup();
    const queueAbort = new AbortController();
    const lockAbort = new AbortController();
    const steps: string[] = [];
    const lookup = mock(() => Promise.resolve(documentId));
    const job = documentOcrJob({
      processing: { documentId: lookup },
      locks: {
        async run(key, recognize) {
          expect(key).toBe(`document:test-workspace:${documentId}`);
          steps.push('lock entered');
          const result = await recognize(lockAbort.signal);
          steps.push('lock released');
          return result;
        },
      },
      io: {
        async run(subject, recognize) {
          expect(subject).toEqual({
            kind: 'document',
            workspaceId: scope.workspaceId,
            documentId,
          });
          steps.push('barrier entered');
          const result = await recognize();
          steps.push('barrier released');
          return result;
        },
      },
      recognize(input, signal) {
        expect(input).toEqual(scope);
        expect(signal.aborted).toBe(false);
        steps.push('OCR');
        const reason = new Error('execution interrupted');
        (cancelledBy === 'queue' ? queueAbort : lockAbort).abort(reason);
        expect(signal.reason).toBe(reason);
        return Promise.resolve();
      },
      timeoutMs: 1000,
    });

    await job.execute(scope, envelope.payload, queueAbort.signal);

    expect(lookup).toHaveBeenCalledWith(scope.workspaceId, scope.runId);
    expect(steps).toEqual([
      'lock entered',
      'barrier entered',
      'OCR',
      'barrier released',
      'lock released',
    ]);
  },
);

test('OCR skips a run without a document before acquiring the lock or starting writes', async () => {
  const scope = await setup();
  const unexpected = mock(() => {
    throw new Error('UNEXPECTED_OCR_IO');
  });
  const job = documentOcrJob({
    processing: { documentId: () => Promise.resolve(null) },
    locks: { run: unexpected },
    io: { run: unexpected },
    recognize: unexpected,
    timeoutMs: 1000,
  });
  await job.execute(scope, envelope.payload, new AbortController().signal);
  expect(unexpected).not.toHaveBeenCalled();
});
