import {
  BackendConfigError,
  createBackend,
  createWorkerRuntime,
  resolveBackendMode,
  type WorkerBackend,
} from '@anyko/backend/runtime';
import { createLogger } from '@anyko/logger';

import { parseBackendEnv } from './backend-config';
import { parseWorkerConfig } from './config';

export async function startWorker() {
  let diagnostic: Awaited<ReturnType<typeof createWorkerRuntime>> | undefined;
  let backend: WorkerBackend | undefined;
  try {
    const config = parseWorkerConfig(process.env);
    const logger = createLogger({
      service: 'worker',
      environment: config.NODE_ENV,
      release: config.RELEASE,
      level: config.LOG_LEVEL,
    });
    const mode = resolveBackendMode({
      documentsEnabled: config.DOCUMENTS_ENABLED === 'true',
      worksEnabled: config.WORKS_ENABLED === 'true',
    });
    diagnostic = await createWorkerRuntime({
      redisUrl: config.REDIS_URL,
      queueName: config.QUEUE_NAME,
      concurrency: config.WORKER_CONCURRENCY,
      startupTimeoutMs: config.STARTUP_TIMEOUT_MS,
      shutdownTimeoutMs: config.SHUTDOWN_TIMEOUT_MS,
      logger,
    });
    let documentWorker:
      Awaited<ReturnType<WorkerBackend['startDocumentWorker']>> | undefined;
    let workWorker:
      Awaited<ReturnType<WorkerBackend['startWorkWorker']>> | undefined;
    if (mode === 'full') {
      backend = createBackend(
        parseBackendEnv(process.env, {
          redisUrl: config.REDIS_URL,
          shutdownTimeoutMs: config.SHUTDOWN_TIMEOUT_MS,
        }),
        { logger, role: 'worker' },
      );
      await backend.ready();
      documentWorker = await backend.startDocumentWorker();
      workWorker = await backend.startWorkWorker();
    }
    const server = Bun.serve({
      hostname: config.WORKER_HOST,
      port: config.WORKER_PORT,
      fetch(request) {
        const path = new URL(request.url).pathname;
        if (path === '/health/live') return Response.json({ status: 'ok' });
        if (path === '/health/ready') {
          const diagnosticState = diagnostic?.state() ?? 'stopped';
          const state =
            diagnosticState === 'ready'
              ? documentWorker?.state() === 'ready' || !documentWorker
                ? (workWorker?.state() ?? 'ready')
                : documentWorker.state()
              : diagnosticState;
          return Response.json(
            { status: state },
            { status: state === 'ready' ? 200 : 503 },
          );
        }
        return new Response(null, { status: 404 });
      },
    });
    let stopping = false;
    const shutdown = async () => {
      if (stopping) return;
      stopping = true;
      try {
        // The backend stops its queue workers first, then releases the shared pool.
        await Promise.all([diagnostic?.stop(), backend?.stop()]);
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
    if (process.platform === 'win32')
      process.on('SIGBREAK', () => {
        void shutdown();
      });
  } catch (error) {
    await Promise.allSettled([diagnostic?.stop(), backend?.stop()]);
    console.error(
      error instanceof BackendConfigError ||
        (error instanceof Error && error.message.startsWith('INVALID_ENV:'))
        ? error.message
        : 'WORKER_STARTUP_FAILED',
    );
    process.exitCode = 1;
  }
}
