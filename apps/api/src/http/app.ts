import { Elysia } from 'elysia';
import { createLogger, type Logger } from '@anyko/logger';
import { DocumentError } from '@anyko/backend/documents';
import { documentRoutes, type DocumentHttpOptions } from './routes/documents';
import { authRoutes } from './routes/auth';
import { WorkError } from '@anyko/backend/works';
import { workRoutes, type WorkHttpOptions } from './routes/works';

export function createApp(options?: {
  logger?: Logger;
  ready?: () => boolean;
  documentHttp?: DocumentHttpOptions;
  workHttp?: WorkHttpOptions;
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
    .onError(({ code, error, set, request }) => {
      const id = contexts.get(request)?.requestId ?? crypto.randomUUID();
      set.headers['x-request-id'] = id;
      const status =
        error instanceof WorkError
          ? error.code === 'NOT_FOUND'
            ? 404
            : error.code === 'FORBIDDEN'
              ? 403
              : error.code === 'INVALID_WORK_INPUT'
                ? 400
                : 409
          : error instanceof DocumentError
            ? error.code === 'NOT_FOUND'
              ? 404
              : error.code === 'INVALID_DOCUMENT' ||
                  error.code === 'UNSUPPORTED_DOCUMENT_FORMAT'
                ? 400
                : 409
            : code === 'NOT_FOUND'
              ? 404
              : code === 'VALIDATION' || code === 'PARSE'
                ? 400
                : 500;
      set.status = status;
      const errorCode =
        error instanceof DocumentError || error instanceof WorkError
          ? error.code
          : status === 404
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
    .use(
      options?.documentHttp
        ? new Elysia()
            .use(authRoutes(options.documentHttp.access))
            .use(documentRoutes(options.documentHttp))
        : new Elysia(),
    )
    .use(options?.workHttp ? workRoutes(options.workHttp) : new Elysia())
    .get('/health', () => ({ status: 'ok' }))
    .get('/health/live', () => ({ status: 'ok' }))
    .get('/health/ready', ({ set }) => {
      const ready = options?.ready?.() ?? true;
      if (!ready) set.status = 503;
      return { status: ready ? 'ready' : 'stopping' };
    });
}
