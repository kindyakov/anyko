import { createApp } from './app';
import { createLogger } from '@anyko/logger';
import { parseApiConfig } from './config';
try {
  const config = parseApiConfig(process.env);
  const logger = createLogger({
    service: 'api',
    environment: config.NODE_ENV,
    release: config.RELEASE,
    level: config.LOG_LEVEL,
  });
  let ready = false;
  const app = createApp({ logger, ready: () => ready }).listen({
    hostname: config.API_HOST,
    port: config.API_PORT,
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
  createLogger({
    service: 'api',
    environment: 'unknown',
    release: 'unknown',
    level: 'error',
  }).fatal({ event: 'startup_failed', errorCode: 'CONFIG_OR_LISTEN_FAILED' });
  process.exitCode = 1;
}
