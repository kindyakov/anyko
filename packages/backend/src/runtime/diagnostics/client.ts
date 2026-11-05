import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { z } from 'zod';

const resultSchema = z
  .object({ status: z.literal('ok'), correlationId: z.uuid() })
  .strict();

export async function runDiagnostic(options: {
  redisUrl: string;
  queueName: string;
  timeoutMs: number;
  correlationId: string;
  delayMs?: number;
}): Promise<unknown> {
  const connection = new Redis(options.redisUrl, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: options.timeoutMs,
    lazyConnect: true,
  });
  connection.on('error', () => undefined);
  const queue = new Queue(options.queueName, { connection });
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        await queue.waitUntilReady();
        controller.signal.throwIfAborted();
        const job = await queue.add(
          'diagnostic.ping',
          {
            version: 1,
            type: 'diagnostic.ping',
            correlationId: options.correlationId,
            ...(options.delayMs === undefined
              ? {}
              : { delayMs: options.delayMs }),
          },
          { removeOnComplete: 50, removeOnFail: 50, attempts: 1 },
        );
        while (!controller.signal.aborted) {
          const saved = await queue.getJob(job.id ?? 'missing');
          if (!saved) throw new Error('DIAGNOSTIC_RESULT_MISSING');
          if (await saved.isCompleted()) {
            // The fetched Job is a snapshot; completion may happen after that read.
            const completed = await queue.getJob(job.id ?? 'missing');
            const result: unknown = completed?.returnvalue;
            const parsed = resultSchema.safeParse(result);
            if (
              !parsed.success ||
              parsed.data.correlationId !== options.correlationId
            )
              throw new Error('INVALID_DIAGNOSTIC_RESULT');
            return parsed.data;
          }
          if (await saved.isFailed()) throw new Error('DIAGNOSTIC_JOB_FAILED');
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        throw new Error('DIAGNOSTIC_TIMEOUT');
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('DIAGNOSTIC_TIMEOUT'));
        }, options.timeoutMs);
      }),
    ]);
  } finally {
    controller.abort();
    if (timer) clearTimeout(timer);
    // Disconnect first: waiting for graceful close during a stalled handshake has no deadline.
    connection.disconnect();
    await Promise.allSettled([queue.close()]);
  }
}
