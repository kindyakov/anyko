import { expect, test } from 'bun:test';
import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { createLogger } from '@anyko/logger';
import { createWorkerRuntime } from '../../src/runtime/diagnostics/worker';
import { runDiagnostic } from '../../src/runtime/diagnostics/client';
import { createServer, connect, type Socket } from 'node:net';

const redisUrl = process.env.TEST_REDIS_URL;
if (!redisUrl)
  throw new Error(
    'TEST_REDIS_URL is required for the explicit integration suite',
  );
const logger = createLogger({
  service: 'worker',
  environment: 'test',
  release: 'integration',
  level: 'fatal',
});

test('unavailable Redis fails startup within deadline and releases clients', async () => {
  // An owned listener accepts TCP but never speaks Redis, exercising stalled handshake cleanup.
  const sockets = new Set<Bun.Socket>();
  const listener = Bun.listen({
    hostname: '127.0.0.1',
    port: 0,
    socket: {
      open(socket) {
        sockets.add(socket);
      },
      data() {},
      close(socket) {
        sockets.delete(socket);
      },
    },
  });
  const started = performance.now();
  let failure: unknown;
  try {
    try {
      await createWorkerRuntime({
        redisUrl: `redis://127.0.0.1:${String(listener.port)}`,
        queueName: `anyko-test-${crypto.randomUUID()}`,
        concurrency: 1,
        startupTimeoutMs: 200,
        shutdownTimeoutMs: 200,
        logger,
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    if (!(failure instanceof Error)) throw new Error('Startup must fail');
    expect(failure.message).toBe('WORKER_STARTUP_FAILED');
    expect(performance.now() - started).toBeLessThan(2000);
  } finally {
    for (const socket of sockets) socket.terminate();
    listener.stop(true);
  }
});

test('diagnostic timeout settles while the Redis handshake is stalled', async () => {
  const sockets = new Set<Bun.Socket>();
  const listener = Bun.listen({
    hostname: '127.0.0.1',
    port: 0,
    socket: {
      open(socket) {
        sockets.add(socket);
      },
      data() {},
      close(socket) {
        sockets.delete(socket);
      },
    },
  });
  const started = performance.now();
  let failure: unknown;
  try {
    try {
      await runDiagnostic({
        redisUrl: `redis://127.0.0.1:${String(listener.port)}`,
        queueName: 'anyko-stalled-test',
        timeoutMs: 100,
        correlationId: crypto.randomUUID(),
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    if (!(failure instanceof Error)) throw new Error('Diagnostic must timeout');
    expect(failure.message).toBe('DIAGNOSTIC_TIMEOUT');
    expect(performance.now() - started).toBeLessThan(1000);
  } finally {
    for (const socket of sockets) socket.terminate();
    listener.stop(true);
  }
});

test('blocking-only connection loss closes readiness until its handshake recovers', async () => {
  const upstream = new URL(redisUrl);
  const sockets: Socket[] = [];
  let connections = 0;
  let holdReconnect = true;
  const proxy = createServer((client) => {
    connections++;
    sockets.push(client);
    client.on('error', () => undefined);
    if (connections > 2 && holdReconnect) return;
    const remote = connect(Number(upstream.port || '6379'), upstream.hostname);
    sockets.push(remote);
    remote.on('error', () => undefined);
    client.pipe(remote);
    remote.pipe(client);
  });
  await new Promise<void>((resolve) => {
    proxy.listen(0, '127.0.0.1', resolve);
  });
  const address = proxy.address();
  if (!address || typeof address === 'string')
    throw new Error('Proxy address missing');
  const queueName = `anyko-test-${crypto.randomUUID()}`;
  const runtime = await createWorkerRuntime({
    redisUrl: `redis://127.0.0.1:${String(address.port)}`,
    queueName,
    concurrency: 1,
    startupTimeoutMs: 2000,
    shutdownTimeoutMs: 2000,
    logger,
  });
  try {
    expect(connections).toBe(2);
    sockets[2]?.destroy();
    sockets[3]?.destroy();
    await Bun.sleep(300);
    expect(runtime.state()).toBe('degraded');
    holdReconnect = false;
    for (const socket of sockets.slice(4)) socket.destroy();
    const deadline = performance.now() + 2000;
    while (runtime.state() !== 'ready' && performance.now() < deadline)
      await Bun.sleep(10);
    expect(runtime.state()).toBe('ready');
  } finally {
    holdReconnect = false;
    await runtime.stop();
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => {
      proxy.close(() => {
        resolve();
      });
    });
  }
});

test('real Redis delivers a diagnostic job and runtime stops idempotently', async () => {
  const queueName = `anyko-test-${crypto.randomUUID()}`;
  const runtime = await createWorkerRuntime({
    redisUrl,
    queueName,
    concurrency: 1,
    startupTimeoutMs: 2000,
    shutdownTimeoutMs: 2000,
    logger,
  });
  const correlationId = crypto.randomUUID();
  try {
    expect(runtime.state()).toBe('ready');
    expect(
      await runDiagnostic({
        redisUrl,
        queueName,
        timeoutMs: 2000,
        correlationId,
      }),
    ).toEqual({ status: 'ok', correlationId });
  } finally {
    await Promise.all([runtime.stop(), runtime.stop()]);
    expect(runtime.state()).toBe('stopped');
    const connection = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
    const queue = new Queue(queueName, { connection });
    try {
      await queue.obliterate({ force: true });
    } finally {
      await queue.close();
      connection.disconnect();
    }
  }
});

test('malformed envelope fails permanently rather than being executed or retried', async () => {
  const queueName = `anyko-test-${crypto.randomUUID()}`;
  const runtime = await createWorkerRuntime({
    redisUrl,
    queueName,
    concurrency: 1,
    startupTimeoutMs: 2000,
    shutdownTimeoutMs: 2000,
    logger,
  });
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue(queueName, { connection });
  const eventsConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const events = new QueueEvents(queueName, { connection: eventsConnection });
  try {
    await events.waitUntilReady();
    const job = await queue.add(
      'diagnostic.ping',
      {
        version: 999,
        type: 'diagnostic.ping',
        correlationId: crypto.randomUUID(),
      },
      { attempts: 3 },
    );
    let failure: unknown;
    try {
      await job.waitUntilFinished(events, 2000);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    if (!(failure instanceof Error)) throw new Error('Job must fail');
    expect(failure.message).toBe('INVALID_JOB_ENVELOPE');
    const saved = await queue.getJob(job.id ?? 'missing');
    expect(saved?.attemptsMade).toBe(1);
  } finally {
    await runtime.stop();
    await events.close();
    await queue.obliterate({ force: true });
    await queue.close();
    connection.disconnect();
    eventsConnection.disconnect();
  }
});

test('worker becomes degraded on its connection loss and recovers consumption', async () => {
  const queueName = `anyko-test-${crypto.randomUUID()}`;
  const observed: string[] = [];
  const runtime = await createWorkerRuntime({
    redisUrl,
    queueName,
    concurrency: 1,
    startupTimeoutMs: 2000,
    shutdownTimeoutMs: 2000,
    logger: {
      ...logger,
      warn(event) {
        observed.push(event.event);
      },
      info(event) {
        observed.push(event.event);
      },
    },
  });
  const admin = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  try {
    const clients: unknown = await admin.client('LIST');
    if (typeof clients !== 'string')
      throw new Error('Unexpected Redis client list');
    const own = clients
      .split('\n')
      .find((line) => line.split(' ').includes(`name=anyko:${queueName}`));
    const id = own
      ?.split(' ')
      .find((field) => field.startsWith('id='))
      ?.slice(3);
    if (!id || !/^\d+$/.test(id))
      throw new Error('Owned worker client missing');
    await admin.client('KILL', 'ID', id);
    const deadline = performance.now() + 2000;
    while (
      !observed.includes('worker.recovered') &&
      performance.now() < deadline
    )
      await Bun.sleep(10);
    expect(observed).toContain('worker.degraded');
    expect(observed).toContain('worker.recovered');
    expect(runtime.state()).toBe('ready');
    const correlationId = crypto.randomUUID();
    expect(
      await runDiagnostic({
        redisUrl,
        queueName,
        correlationId,
        timeoutMs: 2000,
      }),
    ).toEqual({ status: 'ok', correlationId });
  } finally {
    await runtime.stop();
    const queue = new Queue(queueName, { connection: admin });
    try {
      await queue.obliterate({ force: true });
    } finally {
      await queue.close();
      admin.disconnect();
    }
  }
});

test('stop drains an active diagnostic job before reporting stopped', async () => {
  const queueName = `anyko-test-${crypto.randomUUID()}`;
  const runtime = await createWorkerRuntime({
    redisUrl,
    queueName,
    concurrency: 1,
    startupTimeoutMs: 2000,
    shutdownTimeoutMs: 2000,
    logger,
  });
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  const eventsConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue(queueName, { connection });
  const events = new QueueEvents(queueName, {
    connection: eventsConnection,
    lastEventId: '0-0',
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await events.waitUntilReady();
    const active = new Promise<void>((resolve, reject) => {
      events.once('active', () => {
        resolve();
      });
      timer = setTimeout(() => {
        reject(new Error('ACTIVE_EVENT_TIMEOUT'));
      }, 2000);
    });
    const correlationId = crypto.randomUUID();
    const job = await queue.add('diagnostic.ping', {
      version: 1,
      type: 'diagnostic.ping',
      correlationId,
      delayMs: 500,
    });
    await active;
    const stopping = runtime.stop();
    expect(runtime.state()).toBe('stopping');
    await stopping;
    expect(runtime.state()).toBe('stopped');
    expect(await job.getState()).toBe('completed');
    const saved = await queue.getJob(job.id ?? 'missing');
    expect(saved?.returnvalue).toEqual({ status: 'ok', correlationId });
  } finally {
    if (timer) clearTimeout(timer);
    await runtime.stop();
    await events.close();
    await queue.obliterate({ force: true });
    await queue.close();
    connection.disconnect();
    eventsConnection.disconnect();
  }
});

test('queue deduplicates submission and an explicit replay reexecutes the same envelope', async () => {
  const queueName = `anyko-test-${crypto.randomUUID()}`;
  let processed = 0;
  const runtime = await createWorkerRuntime({
    redisUrl,
    queueName,
    concurrency: 1,
    startupTimeoutMs: 2000,
    shutdownTimeoutMs: 2000,
    logger: {
      ...logger,
      info(event) {
        if (event.event === 'job.processed') processed++;
      },
    },
  });
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  const eventsConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue(queueName, { connection });
  const events = new QueueEvents(queueName, { connection: eventsConnection });
  try {
    await events.waitUntilReady();
    const correlationId = crypto.randomUUID();
    const data = { version: 1, type: 'diagnostic.ping', correlationId };
    const job = await queue.add('diagnostic.ping', data, {
      jobId: 'same-submission',
    });
    const expected = { status: 'ok', correlationId };
    const first: unknown = await job.waitUntilFinished(events, 2000);
    expect(first).toEqual(expected);
    const duplicate = await queue.add('diagnostic.ping', data, {
      jobId: 'same-submission',
    });
    expect(duplicate.id).toBe(job.id);
    const second: unknown = await duplicate.waitUntilFinished(events, 2000);
    expect(second).toEqual(expected);
    expect(processed).toBe(1);
    // Delivery can execute a handler again; queue deduplication is not exactly-once execution.
    await duplicate.retry('completed');
    const replay: unknown = await duplicate.waitUntilFinished(events, 2000);
    expect(replay).toEqual(expected);
    expect(processed).toBe(2);
  } finally {
    await runtime.stop();
    await events.close();
    await queue.obliterate({ force: true });
    await queue.close();
    connection.disconnect();
    eventsConnection.disconnect();
  }
});
