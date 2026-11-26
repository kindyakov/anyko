import {
  type ApiBackend,
  BackendConfigError,
  createBackend,
  resolveBackendMode,
} from '@anyko/backend/runtime';
import { createLogger, diagnoseFailure } from '@anyko/logger';

import { createApp } from '../http/app';

import { parseBackendEnv } from './backend-config';
import { parseApiConfig } from './config';

export async function startApi() {
  let backend: ApiBackend | undefined;
  try {
    const config = parseApiConfig(process.env);
    const logger = createLogger({
      service: 'api',
      environment: config.NODE_ENV,
      release: config.RELEASE,
      level: config.LOG_LEVEL,
    });
    const mode = resolveBackendMode({
      documentsEnabled: config.DOCUMENTS_ENABLED,
      worksEnabled: config.WORKS_ENABLED,
    });
    backend =
      mode === 'full'
        ? createBackend(parseBackendEnv(process.env), {
            logger,
            role: 'api',
            packageCatalog: 'published',
          })
        : undefined;
    await backend?.ready();
    let ready = false;
    const app = createApp({
      logger,
      environment: config.NODE_ENV,
      ready: () => ready,
      ...(backend
        ? {
            documentHttp: backend.documentHttp,
            workHttp: backend.workHttp,
          }
        : {}),
    }).listen({
      hostname: config.API_HOST,
      port: config.API_PORT,
      maxRequestBodySize: 21 * 1024 * 1024,
      idleTimeout: 30,
    });
    ready = true;
    logger.info({ event: 'process_ready', port: config.API_PORT });
    let stopping = false;
    const stop = async () => {
      if (stopping) return;
      stopping = true;
      ready = false;
      logger.info({ event: 'process_stopping' });
      const timer = setTimeout(() => {
        logger.fatal({ event: 'shutdown_timeout' });
        process.exit(1);
      }, config.SHUTDOWN_TIMEOUT_MS);
      try {
        await app.stop();
        await backend?.stop();
        logger.info({ event: 'process_stopped' });
      } catch (error) {
        const failure = diagnoseFailure(error, {
          code: 'API_SHUTDOWN_FAILED',
          message: 'Не удалось завершить работу API.',
          operation: 'api.shutdown',
        });
        logger.error({
          event: 'shutdown_failed',
          errorCode: failure.code,
          failure,
        });
        process.exitCode = 1;
      } finally {
        clearTimeout(timer);
      }
    };
    process.on('SIGTERM', () => {
      void stop();
    });
    process.on('SIGINT', () => {
      void stop();
    });
    if (process.platform === 'win32')
      process.on('SIGBREAK', () => {
        void stop();
      });
  } catch (error) {
    await Promise.allSettled([backend?.stop()]);
    const failure = diagnoseFailure(error, {
      code:
        error instanceof BackendConfigError
          ? error.code
          : 'CONFIG_OR_LISTEN_FAILED',
      message:
        error instanceof BackendConfigError
          ? error.message
          : 'Не удалось запустить API.',
      operation: 'api.start',
    });
    createLogger({
      service: 'api',
      environment: 'unknown',
      release: 'unknown',
      level: 'error',
    }).fatal({
      event: 'startup_failed',
      errorCode: failure.code,
      failure,
    });
    process.exitCode = 1;
  }
}
