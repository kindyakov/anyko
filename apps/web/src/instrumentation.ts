import type { Instrumentation } from 'next';

import { errorReference } from '@/lib/error-reference';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { serverLogger } = await import('@/lib/server/logger');
    serverLogger().info({ event: 'process_initialized' });
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { correlationId, diagnoseFailure } = await import('@anyko/logger');
  const { serverLogger } = await import('@/lib/server/logger');
  const failure = diagnoseFailure(error, {
    code: 'WEB_REQUEST_FAILED',
    message: 'Сервер Web не завершил обработку запроса.',
    operation: 'web.handleRequest',
  });
  const logger = serverLogger();
  const log =
    failure.code === 'SESSION_API_REJECTED' ? logger.info : logger.error;
  log({
    event: 'web_request_failed',
    correlationId: correlationId(
      request.headers['x-correlation-id']?.toString(),
    ),
    errorDigest: errorReference(error),
    method: request.method,
    route: context.routePath,
    errorCode: failure.code,
    failure,
  });
};
