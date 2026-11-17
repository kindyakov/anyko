import { Queue, UnrecoverableError, Worker } from 'bullmq';
import { Redis } from 'ioredis';

import {
  type JobRuntime,
  parseJobEnvelope,
  parseWorkerQueues,
  type RunJob,
  type WorkerQueue,
  workerQueues,
} from '@anyko/backend/jobs';

import { dispatchOutbox } from '../loops/dispatcher';
import { reconcileJobs } from '../loops/reconciler';

export async function startJobWorker(
  runtime: JobRuntime,
  options: {
    queues?: string;
    prefix?: string;
    /** Queue-name aliases are confined to tests that already own isolated queues. */
    queueNames?: Partial<Record<WorkerQueue, string>>;
  } = {},
) {
  const selected = parseWorkerQueues(options.queues);
  const prefix = options.prefix ?? 'bull';
  const connection = new Redis(runtime.redisUrl, {
    maxRetriesPerRequest: null,
    connectTimeout: 5000,
  });
  const producer = new Redis(runtime.redisUrl, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 5000,
    commandTimeout: 5000,
  });
  const queues = new Map<WorkerQueue, Queue>();
  const workers: Worker[] = [];
  const controller = new AbortController();
  let healthy = false;
  let stopping: Promise<void> | undefined;
  let loop = Promise.resolve();
  const queueName = (name: WorkerQueue) => options.queueNames?.[name] ?? name;
  const enqueue = async (
    queue: WorkerQueue,
    definition: RunJob,
    data: unknown,
    id: string,
  ) => {
    const target = queues.get(queue);
    if (!target) throw new Error('QUEUE_NOT_REGISTERED');
    await target.add(definition.name, data, {
      jobId: id,
      removeOnComplete: 100,
      removeOnFail: 100,
      attempts: definition.retry.attempts,
      backoff: { type: 'exponential', delay: definition.retry.backoffMs },
    });
  };
  const degrade = () => {
    healthy = false;
  };
  connection.on('error', degrade);
  connection.on('close', degrade);
  producer.on('error', degrade);
  producer.on('close', degrade);
  for (const name of workerQueues)
    queues.set(
      name,
      new Queue(queueName(name), { connection: producer, prefix }),
    );
  for (const name of selected) {
    const worker = new Worker<unknown>(
      queueName(name),
      async (job) => {
        const definition = runtime.registry.definitions.find(
          (entry) => entry.name === job.name,
        );
        if (!definition || definition.queue !== name)
          throw new UnrecoverableError('UNKNOWN_JOB');
        const signal = AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(definition.timeoutMs),
        ]);
        if (definition.kind === 'scheduled') {
          let envelope;
          try {
            envelope = parseJobEnvelope(
              job.data,
              definition.version,
              'scheduled',
            );
          } catch {
            throw new UnrecoverableError('INVALID_JOB_ENVELOPE');
          }
          await definition.execute(
            {
              clock: runtime.clock,
              logger: runtime.logger,
              signal,
              correlationId: envelope.correlationId,
            },
            envelope.payload,
            signal,
          );
        } else {
          let envelope;
          try {
            envelope = parseJobEnvelope(job.data, definition.version);
          } catch {
            throw new UnrecoverableError('INVALID_JOB_ENVELOPE');
          }
          const scope = await runtime.registry.scope(envelope, definition.name);
          if (!scope) throw new UnrecoverableError('STALE_JOB_EXECUTION');
          await definition.execute(scope, envelope.payload, signal);
        }
      },
      { connection, prefix, concurrency: 1 },
    );
    worker.on('error', degrade);
    worker.on('failed', (job) => {
      runtime.logger.warn({ event: 'job.failed', jobId: job?.id ?? 'unknown' });
    });
    workers.push(worker);
  }
  const stop = () =>
    (stopping ??= (async () => {
      controller.abort();
      healthy = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          Promise.all([loop, ...workers.map((worker) => worker.close())]),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              reject(new Error('WORKER_SHUTDOWN_TIMEOUT'));
            }, runtime.shutdownTimeoutMs);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
        connection.disconnect();
        producer.disconnect();
        await Promise.allSettled([
          ...workers.map((worker) => worker.close(true)),
          ...[...queues.values()].map((queue) => queue.close()),
        ]);
      }
    })());
  let startupTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all([
        ...workers.map((worker) => worker.waitUntilReady()),
        ...[...queues.values()].map((queue) => queue.waitUntilReady()),
      ]),
      new Promise<never>((_, reject) => {
        startupTimer = setTimeout(() => {
          reject(new Error('WORKER_STARTUP_TIMEOUT'));
        }, 10000);
      }),
    ]);
    if (selected.includes('maintenance')) {
      const maintenance = queues.get('maintenance');
      if (!maintenance) throw new Error('MAINTENANCE_QUEUE_MISSING');
      for (const schedule of runtime.registry.schedules) {
        const definition = runtime.registry.definitions.find(
          (entry) => entry.name === schedule.name,
        );
        if (!definition || definition.kind !== 'scheduled')
          throw new Error('INVALID_JOB_SCHEDULE');
        await maintenance.upsertJobScheduler(
          `schedule-${definition.name}-v${String(definition.version)}`,
          { every: schedule.everyMs },
          {
            name: definition.name,
            data: {
              envelopeVersion: 1,
              version: definition.version,
              correlationId: runtime.newId(),
              payload: {},
            },
            opts: {
              removeOnComplete: 100,
              removeOnFail: 100,
              attempts: definition.retry.attempts,
              backoff: {
                type: 'exponential',
                delay: definition.retry.backoffMs,
              },
            },
          },
        );
      }
    }
  } catch (error) {
    await stop();
    throw error;
  } finally {
    if (startupTimer) clearTimeout(startupTimer);
  }
  loop = (async () => {
    while (!controller.signal.aborted) {
      try {
        await reconcileJobs(runtime);
        await dispatchOutbox(runtime, enqueue);
        healthy =
          connection.status === 'ready' &&
          producer.status === 'ready' &&
          workers.every(
            (worker) =>
              worker.isRunning() &&
              worker.getBackend().blockingConnection?.status === 'ready',
          );
      } catch {
        healthy = false;
        runtime.logger.warn({ event: 'job_dispatch_failed' });
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  })();
  const handle = {
    state: () =>
      controller.signal.aborted ? 'stopping' : healthy ? 'ready' : 'degraded',
    stop,
  };
  runtime.track(handle);
  return handle;
}
