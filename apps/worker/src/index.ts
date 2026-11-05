import { createLogger } from '@anyko/logger';
import { createWorkerRuntime } from '@anyko/backend/runtime';
import { parseWorkerConfig } from './config';

try {
  const config = parseWorkerConfig(process.env);
  const logger = createLogger({
    service: 'worker',
    environment: config.NODE_ENV,
    release: config.RELEASE,
    level: config.LOG_LEVEL,
  });
  const runtime = await createWorkerRuntime({
    redisUrl: config.REDIS_URL,
    queueName: config.QUEUE_NAME,
    concurrency: config.WORKER_CONCURRENCY,
    startupTimeoutMs: config.STARTUP_TIMEOUT_MS,
    shutdownTimeoutMs: config.SHUTDOWN_TIMEOUT_MS,
    logger,
  });
  let server;
  try {
    server = Bun.serve({
      hostname: config.WORKER_HOST,
      port: config.WORKER_PORT,
      fetch(request) {
        const path = new URL(request.url).pathname;
        if (path === '/health/live') return Response.json({ status: 'ok' });
        if (path === '/health/ready') {
          const state = runtime.state();
          return Response.json(
            { status: state },
            { status: state === 'ready' ? 200 : 503 },
          );
        }
        return new Response(null, { status: 404 });
      },
    });
  } catch {
    await runtime.stop();
    throw new Error('WORKER_LISTEN_FAILED');
  }
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    try {
      await runtime.stop();
      logger.info({ event: 'worker.stopped' });
    } catch {
      logger.error({ event: 'worker.shutdown_failed' });
      process.exitCode = 1;
    } finally {
      await server.stop(true);
    }
  };
  process.on('SIGTERM', () => {
    void shutdown();
  });
  process.on('SIGINT', () => {
    void shutdown();
  });
} catch (error) {
  console.error(
    error instanceof Error && error.message.startsWith('INVALID_ENV:')
      ? error.message
      : 'WORKER_STARTUP_FAILED',
  );
  process.exitCode = 1;
}
