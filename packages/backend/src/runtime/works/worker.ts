import { Queue, UnrecoverableError, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { z } from 'zod';

import { createWorkCleanup } from '../../workflows/works/cleanup';
import { createWorkExecution } from '../../workflows/works/execute';

import { createWorkRuntime, type WorkRuntimeOptions } from './resources';

const envelope = z
  .object({
    version: z.literal(1),
    workspaceId: z.string().min(1),
    runId: z.uuid(),
  })
  .strict();
export async function createWorkWorker(
  options: WorkRuntimeOptions & {
    redisUrl: string;
    queueName?: string;
    shutdownTimeoutMs?: number;
  },
) {
  const runtime = createWorkRuntime(options);
  const controller = new AbortController();
  const name = options.queueName ?? 'anyko-work-pipeline';
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
  const queue = new Queue(name, { connection: producer });
  const execute = createWorkExecution(runtime.deps);
  const cleanup = createWorkCleanup(runtime.deps);
  let healthy = false,
    stopping: Promise<void> | undefined;
  connection.on('error', () => {
    healthy = false;
  });
  producer.on('error', () => {
    healthy = false;
  });
  const worker = new Worker<unknown>(
    name,
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
            }, options.shutdownTimeoutMs ?? 10000);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
        connection.disconnect();
        producer.disconnect();
        await Promise.allSettled([
          worker.close(true),
          queue.close(),
          runtime.stop(),
        ]);
      }
    })());
  let startupTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all([
        runtime.ready(),
        runtime.deps.agents.ready(),
        queue.waitUntilReady(),
        worker.waitUntilReady(),
      ]),
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
        await runtime.deps.processing.reconcile();
        await cleanup();
        for (let i = 0; i < 20; i++) {
          const item = await runtime.deps.processing.delivery();
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
            await runtime.deps.processing.delivered(item.id, item.token);
          } catch {
            await runtime.deps.processing.release(item.id, item.token);
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
