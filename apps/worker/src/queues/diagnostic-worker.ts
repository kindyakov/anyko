import { UnrecoverableError, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { z } from 'zod';

import type { Logger } from '@anyko/logger';

const envelope = z
  .object({
    version: z.literal(1),
    type: z.literal('diagnostic.ping'),
    correlationId: z.uuid(),
    delayMs: z.number().int().min(0).max(1000).optional(),
  })
  .strict();
type State = 'starting' | 'ready' | 'degraded' | 'stopping' | 'stopped';

export async function createWorkerRuntime(options: {
  redisUrl: string;
  queueName: string;
  concurrency: number;
  startupTimeoutMs: number;
  shutdownTimeoutMs: number;
  logger: Logger;
}) {
  let state: State = 'starting';
  let blockingReady = false;
  const connection = new Redis(options.redisUrl, {
    connectionName: `anyko:${options.queueName}`,
    maxRetriesPerRequest: null,
    connectTimeout: options.startupTimeoutMs,
  });
  const worker = new Worker<unknown, { status: 'ok'; correlationId: string }>(
    options.queueName,
    async (job) => {
      const parsed = envelope.safeParse(job.data);
      if (!parsed.success || job.name !== 'diagnostic.ping')
        throw new UnrecoverableError('INVALID_JOB_ENVELOPE');
      const { correlationId } = parsed.data;
      if (parsed.data.delayMs)
        await new Promise((resolve) =>
          setTimeout(resolve, parsed.data.delayMs),
        );
      options.logger.info({
        event: 'job.processed',
        jobId: job.id ?? 'unknown',
        jobType: job.name,
        attempt: job.attemptsMade + 1,
        correlationId,
      });
      return { status: 'ok', correlationId };
    },
    { connection, concurrency: options.concurrency },
  );
  const degrade = () => {
    if (state === 'ready') {
      state = 'degraded';
      options.logger.warn({ event: 'worker.degraded' });
    }
  };
  connection.on('error', degrade);
  connection.on('close', degrade);
  worker.on('error', degrade);
  worker.on('failed', (job) => {
    options.logger.warn({ event: 'job.failed', jobId: job?.id ?? 'unknown' });
  });
  const recover = () => {
    if (
      state === 'degraded' &&
      connection.status === 'ready' &&
      blockingReady &&
      worker.isRunning()
    ) {
      state = 'ready';
      options.logger.info({ event: 'worker.recovered' });
    }
  };
  connection.on('ready', recover);
  worker.on('ready', recover);
  const blockingConnection = worker.getBackend().blockingConnection;
  if (!blockingConnection)
    throw new Error('WORKER_BLOCKING_CONNECTION_MISSING');
  blockingConnection.on('close', () => {
    blockingReady = false;
    degrade();
  });
  blockingConnection.on('error', () => {
    blockingReady = false;
    degrade();
  });
  blockingConnection.on('ready', () => {
    blockingReady = true;
    recover();
  });
  let stopping: Promise<void> | undefined;
  const stop = (): Promise<void> => {
    if (stopping) return stopping;
    state = 'stopping';
    stopping = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          worker.pause(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              reject(new Error('WORKER_SHUTDOWN_TIMEOUT'));
            }, options.shutdownTimeoutMs);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
        await worker.close(true);
        connection.disconnect();
        state = 'stopped';
      }
    })();
    return stopping;
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      worker.waitUntilReady(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('WORKER_STARTUP_TIMEOUT'));
        }, options.startupTimeoutMs);
      }),
    ]);
    blockingReady = true;
    state = 'ready';
    options.logger.info({ event: 'worker.ready' });
  } catch {
    await worker.close(true);
    connection.disconnect();
    throw new Error('WORKER_STARTUP_FAILED');
  } finally {
    if (timer) clearTimeout(timer);
  }
  return { state: () => state, stop };
}
