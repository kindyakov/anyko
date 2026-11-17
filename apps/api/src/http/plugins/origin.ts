import type { Elysia } from 'elysia';

import { transportErrorCodes } from '../errors';

// Изменяющие запросы должны прийти с origin приложения (защита от межсайтовых запросов).
export function originGuard(app: Elysia, origin: string): void {
  app.onBeforeHandle(({ request, set }) => {
    if (request.method !== 'GET' && request.headers.get('origin') !== origin) {
      set.status = 403;
      return {
        error: {
          code: transportErrorCodes.INVALID_ORIGIN,
          requestId: set.headers['x-request-id'] ?? '',
        },
      };
    }
  });
}
