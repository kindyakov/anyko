export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { readServerConfig } = await import('./lib/server/config');
    const { createLogger } = await import('@anyko/logger');
    const config = readServerConfig();
    createLogger({
      service: 'web',
      environment: process.env.NODE_ENV,
      release: config.RELEASE,
      level: config.LOG_LEVEL,
    }).info({ event: 'process_initialized' });
  }
}
