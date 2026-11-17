import type { Elysia } from 'elysia';

import { transportErrorCodes } from '../errors';

// Безопасные методы (RFC 9110) не меняют состояние и проходят без origin.
const safeMethods = new Set(['GET', 'HEAD']);

// Изменяющие запросы должны прийти с origin приложения (защита от межсайтовых запросов).
export function originGuard(app: Elysia, origin: string): void {
  app.onBeforeHandle(({ request, set }) => {
    if (
      !safeMethods.has(request.method) &&
      request.headers.get('origin') !== origin
    ) {
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
