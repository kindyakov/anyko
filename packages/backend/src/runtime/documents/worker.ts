import { Queue, UnrecoverableError, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { z } from 'zod';

import type { Logger } from '@anyko/logger';

import type {
  DocumentIo,
  ResourceLocks,
  SourceStorage,
} from '../../modules/documents';
import type { createProcessingService } from '../../modules/processing';

const envelope = z
  .object({
    version: z.literal(1),
    workspaceId: z.string().min(1),
    runId: z.uuid(),
  })
  .strict();

/** Shared clients and workflows built once by `createBackend`; the consumer owns none of them. */
interface DocumentWorkerDeps {
  processing: ReturnType<typeof createProcessingService>;
  io: DocumentIo;
  locks: ResourceLocks;
  storage: SourceStorage;
  logger: Logger;
  execute(
    input: { workspaceId: string; runId: string },
    signal: AbortSignal,
  ): Promise<void>;
  deleteDocuments(): Promise<void>;
  cleanupSources(before: Date): Promise<void>;
}

export async function createDocumentWorker(options: {
  deps: DocumentWorkerDeps;
  redisUrl: string;
  logger: Logger;
  queueName: string;
  shutdownTimeoutMs: number;
}) {
  const { deps } = options;
  const { processing, io, locks } = deps;
  let state: 'starting' | 'ready' | 'degraded' | 'stopping' | 'stopped' =
    'starting';
  const isStopping = () => state === 'stopping' || state === 'stopped';
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
  const worker = new Worker<unknown>(
    options.queueName,
    async (job) => {
      const payload = envelope.safeParse(job.data);
      if (!payload.success || job.name !== 'document.ocr')
        throw new UnrecoverableError('INVALID_JOB_ENVELOPE');
      const documentId = await processing.documentId(
        payload.data.workspaceId,
        payload.data.runId,
      );
      if (documentId)
        await locks.run(
          `document:${payload.data.workspaceId}:${documentId}`,
          (signal) =>
            io.run({ workspaceId: payload.data.workspaceId, documentId }, () =>
              deps.execute(payload.data, signal),
            ),
        );
    },
    { connection, concurrency: 1 },
  );
  let mainReady = false,
    blockingReady = false,
    producerReady = false,
    persistenceReady = false;
  const refresh = () => {
    if (state === 'stopping' || state === 'stopped') return;
    state =
      mainReady && blockingReady && producerReady && persistenceReady
        ? 'ready'
        : 'degraded';
  };
  connection.on('error', () => {
    mainReady = false;
    refresh();
  });
  connection.on('close', () => {
    mainReady = false;
    refresh();
  });
  connection.on('ready', () => {
    mainReady = true;
    refresh();
  });
  producer.on('error', () => {
    producerReady = false;
    refresh();
  });
  producer.on('close', () => {
    producerReady = false;
    refresh();
  });
  producer.on('ready', () => {
    producerReady = true;
    persistenceReady = true;
    refresh();
  });
  worker.on('error', () => {
    blockingReady = false;
    refresh();
  });
  const blocking = worker.getBackend().blockingConnection;
  blocking?.on('error', () => {
    blockingReady = false;
    refresh();
  });
  blocking?.on('close', () => {
    blockingReady = false;
    refresh();
  });
  blocking?.on('ready', () => {
    blockingReady = true;
    refresh();
  });
  let stopping: Promise<void> | undefined;
  let loop: Promise<void> = Promise.resolve();
  const stop = () => {
    if (stopping) return stopping;
    state = 'stopping';
    stopping = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          Promise.all([worker.pause(), loop]),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              reject(new Error('DOCUMENT_SHUTDOWN_TIMEOUT'));
            }, options.shutdownTimeoutMs);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
        connection.disconnect();
        producer.disconnect();
        await Promise.allSettled([worker.close(true), queue.close()]);
        state = 'stopped';
      }
    })();
    return stopping;
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all([worker.waitUntilReady(), queue.waitUntilReady()]),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('DOCUMENT_STARTUP_TIMEOUT'));
        }, 10000);
      }),
    ]);
    mainReady = true;
    blockingReady = true;
    producerReady = true;
    state = 'ready';
  } catch {
    await stop();
    throw new Error('DOCUMENT_STARTUP_FAILED');
  } finally {
    if (timer) clearTimeout(timer);
  }
  loop = (async () => {
    while (!isStopping()) {
      try {
        await processing.reconcile();
        await deps.deleteDocuments();
        const before = new Date(Date.now() - 3600000);
        await deps.cleanupSources(before);
        for (const artifact of await processing.orphanResults(before)) {
          await deps.storage.delete(artifact.key);
          await processing.forgetResult(artifact.key);
        }
        for (let i = 0; i < 20; i++) {
          const item = await processing.reserveDelivery();
          if (!item) break;
          try {
            await queue.add(
              'document.ocr',
              { version: 1, workspaceId: item.workspaceId, runId: item.runId },
              {
                jobId: `${item.id}-${item.token}`,
                removeOnComplete: 100,
                removeOnFail: 100,
                attempts: 1,
              },
            );
            await processing.delivered(item.id, item.token);
          } catch {
            await processing.releaseDelivery(item.id, item.token);
            throw new Error('DISPATCH_FAILED');
          }
        }
        persistenceReady = true;
        refresh();
      } catch {
        persistenceReady = false;
        refresh();
        options.logger.warn({ event: 'document_dispatch_failed' });
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  })();
  return { state: () => state, stop };
}
