import { createApp } from '../http/app';
import { createLogger } from '@anyko/logger';
import { parseApiConfig } from './config';
import { parseDocumentConfig } from './document-config';
import { createDocumentRuntime, createS3Storage } from '@anyko/backend/runtime';
import { createAccess } from '@anyko/backend/access';
export async function startApi() {
  const startupResources: Array<() => Promise<void>> = [];
  try {
    const config = parseApiConfig(process.env);
    const logger = createLogger({
      service: 'api',
      environment: config.NODE_ENV,
      release: config.RELEASE,
      level: config.LOG_LEVEL,
    });
    let ready = false;
    const documentConfig = config.DOCUMENTS_ENABLED
      ? parseDocumentConfig(process.env)
      : null;
    const documents = documentConfig
      ? createDocumentRuntime({
          databaseUrl: documentConfig.DATABASE_URL,
          logger,
          storage: createS3Storage({
            endpoint: documentConfig.S3_ENDPOINT,
            bucket: documentConfig.S3_BUCKET,
            accessKeyId: documentConfig.S3_ACCESS_KEY,
            secretAccessKey: documentConfig.S3_SECRET_KEY,
          }),
        })
      : null;
    const access = documentConfig
      ? createAccess({
          databaseUrl: documentConfig.DATABASE_URL,
          secret: documentConfig.AUTH_SECRET,
          baseURL: documentConfig.AUTH_BASE_URL,
          origin: documentConfig.APP_ORIGIN,
        })
      : null;
    if (documents) startupResources.push(documents.stop);
    if (access) startupResources.push(access.stop);
    await documents?.ready();
    const app = createApp({
      logger,
      ready: () => ready,
      ...(documents && access && documentConfig
        ? {
            documentHttp: {
              documents,
              access,
              origin: documentConfig.APP_ORIGIN,
            },
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
        await documents?.stop();
        await access?.stop();
        logger.info({ event: 'process_stopped' });
      } catch {
        logger.error({ event: 'shutdown_failed' });
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
  } catch {
    await Promise.allSettled(startupResources.map((close) => close()));
    createLogger({
      service: 'api',
      environment: 'unknown',
      release: 'unknown',
      level: 'error',
    }).fatal({ event: 'startup_failed', errorCode: 'CONFIG_OR_LISTEN_FAILED' });
    process.exitCode = 1;
  }
}
