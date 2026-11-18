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
  'running OCR is interrupted by %s cancellation',
  async (cancelledBy) => {
    const scope = await setup();
    const queueAbort = new AbortController();
    const lockAbort = new AbortController();
    const started = Promise.withResolvers<true>();
    const job = documentOcrJob({
      processing: { documentId: () => Promise.resolve(documentId) },
      locks: {
        run: (_key, recognize) => recognize(lockAbort.signal),
      },
      io: {
        run: (_subject, recognize) => recognize(),
      },
      recognize(_input, signal) {
        return new Promise<void>((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => {
              const failure: unknown = signal.reason;
              reject(
                failure instanceof Error ? failure : new Error('OCR_ABORTED'),
              );
            },
            { once: true },
          );
          started.resolve(true);
        });
      },
      timeoutMs: 1000,
    });

    const outcome = job
      .execute(scope, envelope.payload, queueAbort.signal)
      .then(
        () => undefined,
        (failure: unknown) => failure,
      );
    await started.promise;
    const reason = new Error('execution interrupted');
    (cancelledBy === 'queue' ? queueAbort : lockAbort).abort(reason);
    expect(await outcome).toBe(reason);
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
