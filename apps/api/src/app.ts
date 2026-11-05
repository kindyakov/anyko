import { Elysia } from 'elysia';
import { createLogger, type Logger } from '@anyko/logger';

export function createApp(options?: {
  logger?: Logger;
  ready?: () => boolean;
}) {
  const logger =
    options?.logger ??
    createLogger({
      service: 'api',
      environment: 'test',
      release: 'local',
      level: 'info',
    });
  const contexts = new WeakMap<
    Request,
    { requestId: string; startedAt: number }
  >();
  return new Elysia()
    .onRequest(({ request, set }) => {
      const context = {
        requestId: crypto.randomUUID(),
        startedAt: performance.now(),
      };
      contexts.set(request, context);
      set.headers['x-request-id'] = context.requestId;
    })
    .onError(({ code, set, request }) => {
      const id = contexts.get(request)?.requestId ?? crypto.randomUUID();
      set.headers['x-request-id'] = id;
      const status =
        code === 'NOT_FOUND'
          ? 404
          : code === 'VALIDATION' || code === 'PARSE'
            ? 400
            : 500;
      set.status = status;
      const errorCode =
        status === 404
          ? 'NOT_FOUND'
          : status === 400
            ? 'INVALID_REQUEST'
            : 'INTERNAL_ERROR';
      if (status === 500)
        logger.error({ event: 'http_failed', requestId: id, errorCode });
      return { error: { code: errorCode, requestId: id } };
    })
    .onAfterResponse(({ request, route, set }) => {
      const context = contexts.get(request);
      logger.info({
        event: 'http_completed',
        requestId: context?.requestId ?? 'unassigned',
        method: request.method,
        route: route || 'unmatched',
        statusCode: typeof set.status === 'number' ? set.status : 200,
        durationMs: Math.round(
          performance.now() - (context?.startedAt ?? performance.now()),
        ),
      });
    })
    .get('/health', () => ({ status: 'ok' }))
    .get('/health/live', () => ({ status: 'ok' }))
    .get('/health/ready', ({ set }) => {
      const ready = options?.ready?.() ?? true;
      if (!ready) set.status = 503;
      return { status: ready ? 'ready' : 'stopping' };
    });
}
