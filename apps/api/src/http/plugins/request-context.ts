import type { Elysia } from 'elysia';

import type { Logger } from '@anyko/logger';

import { attachRequestState, requestState } from '../request-state';

// Correlation ID на каждый запрос и одна запись журнала о завершённом запросе.
export function requestContext(app: Elysia, logger: Logger): void {
  app.onRequest(({ request, set }) => {
    const requestId = crypto.randomUUID();
    attachRequestState(request, requestId);
    set.headers['x-request-id'] = requestId;
  });
  app.onAfterResponse(({ request, route, set }) => {
    const state = requestState(request);
    logger.info({
      event: 'http_completed',
      requestId: state?.requestId ?? 'unassigned',
      method: request.method,
      route: route || 'unmatched',
      statusCode: typeof set.status === 'number' ? set.status : 200,
      durationMs: Math.round(
        performance.now() - (state?.startedAt ?? performance.now()),
      ),
    });
  });
}
