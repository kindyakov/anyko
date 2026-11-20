import type { JobRuntime, RunJob, WorkerQueue } from '@anyko/backend/jobs';

/** Only an outbox lease owner may acknowledge delivery. Redis remains a delivery hint. */
export async function dispatchOutbox(
  runtime: JobRuntime,
  enqueue: (
    queue: WorkerQueue,
    definition: RunJob,
    data: unknown,
    id: string,
  ) => Promise<void>,
) {
  const port = runtime.delivery;
  for (let i = 0; i < 20; i++) {
    const item = await port.reserve();
    if (!item) break;
    try {
      const run = await port.describe(item);
      const definition = runtime.registry.definitions.find(
        (job) => job.name === run?.jobName,
      );
      if (!run || !definition || definition.kind !== 'run')
        throw new Error('UNKNOWN_DELIVERY_JOB');
      await enqueue(
        definition.queue,
        definition,
        {
          envelopeVersion: 1,
          version: definition.version,
          workspaceId: item.workspaceId,
          runId: item.runId,
          correlationId: run.correlationId,
          payload: {},
        },
        `${item.id}-${item.token}`,
      );
      await port.delivered(item.id, item.token);
      runtime.logger.info({
        event: 'job_dispatched',
        correlationId: run.correlationId,
        jobId: `${item.id}-${item.token}`,
        jobType: definition.name,
      });
    } catch (error) {
      await port.release(item.id, item.token);
      throw error;
    }
  }
}
