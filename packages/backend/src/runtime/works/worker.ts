import { Queue, UnrecoverableError, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { z } from 'zod';

import type { Logger } from '@anyko/logger';

import type { WorkDependencies } from '../../workflows/work-dependencies';
import { createWorkExecution } from '../../workflows/work-execution';
import { createWorkCleanup } from '../../workflows/work-maintenance';

const envelope = z
  .object({
    version: z.literal(1),
    workspaceId: z.string().min(1),
    runId: z.uuid(),
  })
  .strict();

export async function createWorkWorker(options: {
  /** Built once by `createBackend`; this consumer creates no database client of its own. */
  deps: WorkDependencies;
  redisUrl: string;
  logger: Logger;
  queueName: string;
  shutdownTimeoutMs: number;
}) {
  const { deps } = options;
  const controller = new AbortController();
  const connection = new Redis(options.redisUrl, {
    maxRetriesPerRequest: null,
    connectTimeout: 5000,
  });
  const producer = new Redis(options.redisUrl, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 5000,
    commandTimeout: 5000,
  });
  const queue = new Queue(options.queueName, { connection: producer });
  const execute = createWorkExecution(deps);
  const cleanup = createWorkCleanup(deps);
  let healthy = false,
    stopping: Promise<void> | undefined;
  connection.on('error', () => {
    healthy = false;
  });
  producer.on('error', () => {
    healthy = false;
  });
  const worker = new Worker<unknown>(
    options.queueName,
    async (job) => {
      const parsed = envelope.safeParse(job.data);
      if (!parsed.success || job.name !== 'work.execute')
        throw new UnrecoverableError('INVALID_JOB_ENVELOPE');
      await execute(
        parsed.data.workspaceId,
        parsed.data.runId,
        controller.signal,
      );
    },
    { connection, concurrency: 1 },
  );
  worker.on('error', () => {
    healthy = false;
  });
  let loop = Promise.resolve();
  const stop = () =>
    (stopping ??= (async () => {
      controller.abort();
      healthy = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          Promise.all([loop, worker.close()]),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              reject(new Error('WORK_SHUTDOWN_TIMEOUT'));
            }, options.shutdownTimeoutMs);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
        connection.disconnect();
        producer.disconnect();
        await Promise.allSettled([worker.close(true), queue.close()]);
      }
    })());
  let startupTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all([queue.waitUntilReady(), worker.waitUntilReady()]),
      new Promise<never>((_, reject) => {
        startupTimer = setTimeout(() => {
          reject(new Error('WORK_STARTUP_TIMEOUT'));
        }, 10000);
      }),
    ]);
  } catch {
    await stop();
    throw new Error('WORK_STARTUP_FAILED');
  } finally {
    if (startupTimer) clearTimeout(startupTimer);
  }
  loop = (async () => {
    while (!controller.signal.aborted) {
      try {
        await deps.processing.internal.reconcile();
        await cleanup();
        for (let i = 0; i < 20; i++) {
          const item = await deps.processing.internal.delivery();
          if (!item) break;
          try {
            await queue.add(
              'work.execute',
              { version: 1, workspaceId: item.workspaceId, runId: item.runId },
              {
                jobId: `${item.id}-${item.token}`,
                removeOnComplete: 100,
                removeOnFail: 100,
                attempts: 1,
              },
            );
            await deps.processing.internal.delivered(item.id, item.token);
          } catch {
            await deps.processing.internal.release(item.id, item.token);
            throw new Error('WORK_DISPATCH_FAILED');
          }
        }
        healthy =
          connection.status === 'ready' &&
          producer.status === 'ready' &&
          worker.isRunning();
      } catch {
        healthy = false;
        options.logger.warn({ event: 'work_dispatch_failed' });
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  })();
  return {
    state: () =>
      controller.signal.aborted ? 'stopping' : healthy ? 'ready' : 'degraded',
    stop,
  };
}
