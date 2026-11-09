import {
  createDocumentWorker,
  createMineruParser,
  createS3Storage,
  createWorkerRuntime,
  createWorkWorker,
  parseWorkConfig,
} from '@anyko/backend/runtime';
import { createLogger } from '@anyko/logger';

import { parseWorkerConfig } from './config';

export async function startWorker() {
  try {
    const config = parseWorkerConfig(process.env);
    const workConfig = parseWorkConfig(process.env);
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
    let documentWorker:
      Awaited<ReturnType<typeof createDocumentWorker>> | undefined;
    if (config.documents) {
      const documents = config.documents;
      try {
        documentWorker = await createDocumentWorker({
          databaseUrl: documents.DATABASE_URL,
          redisUrl: config.REDIS_URL,
          logger,
          storage: createS3Storage({
            endpoint: documents.S3_ENDPOINT,
            bucket: documents.S3_BUCKET,
            accessKeyId: documents.S3_ACCESS_KEY,
            secretAccessKey: documents.S3_SECRET_KEY,
          }),
          parser: createMineruParser({
            baseUrl: documents.MINERU_BASE_URL,
            timeoutMs: documents.MINERU_TIMEOUT_MS,
          }),
          leaseMs: documents.MINERU_TIMEOUT_MS + 60000,
          shutdownTimeoutMs: config.SHUTDOWN_TIMEOUT_MS,
        });
      } catch (error) {
        await runtime.stop();
        throw error;
      }
    }
    let server;
    let workWorker: Awaited<ReturnType<typeof createWorkWorker>> | undefined;
    try {
      if (workConfig && config.documents)
        workWorker = await createWorkWorker({
          databaseUrl: config.documents.DATABASE_URL,
          encryptionKey: workConfig.encryptionKey,
          redisUrl: config.REDIS_URL,
          logger,
          storage: createS3Storage({
            endpoint: config.documents.S3_ENDPOINT,
            bucket: config.documents.S3_BUCKET,
            accessKeyId: config.documents.S3_ACCESS_KEY,
            secretAccessKey: config.documents.S3_SECRET_KEY,
          }),
          shutdownTimeoutMs: config.SHUTDOWN_TIMEOUT_MS,
        });
    } catch (error) {
      await documentWorker?.stop();
      await runtime.stop();
      throw error;
    }
    try {
      server = Bun.serve({
        hostname: config.WORKER_HOST,
        port: config.WORKER_PORT,
        fetch(request) {
          const path = new URL(request.url).pathname;
          if (path === '/health/live') return Response.json({ status: 'ok' });
          if (path === '/health/ready') {
            const diagnosticState = runtime.state();
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
    } catch {
      await documentWorker?.stop();
      await workWorker?.stop();
      await runtime.stop();
      throw new Error('WORKER_LISTEN_FAILED');
    }
    let stopping = false;
    const shutdown = async () => {
      if (stopping) return;
      stopping = true;
      try {
        await Promise.all([
          runtime.stop(),
          documentWorker?.stop(),
          workWorker?.stop(),
        ]);
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
    console.error(
      error instanceof Error && error.message.startsWith('INVALID_ENV:')
        ? error.message
        : 'WORKER_STARTUP_FAILED',
    );
    process.exitCode = 1;
  }
}
