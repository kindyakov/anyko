import 'server-only';

import { createLogger, type Logger } from '@anyko/logger';

import { readServerConfig } from '@/lib/server/config';

let logger: Logger | undefined;

export function serverLogger(): Logger {
  const config = readServerConfig();
  return (logger ??= createLogger({
    service: 'web',
    environment: process.env.NODE_ENV,
    release: config.RELEASE,
    level: config.LOG_LEVEL,
  }));
}
