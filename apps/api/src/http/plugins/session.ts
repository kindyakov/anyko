import type { Elysia } from 'elysia';

import type { createAccess } from '@anyko/backend/access';

import { transportErrorCodes } from '../errors';
import { requestState } from '../request-state';

// Сессия читается один раз на запрос; без неё маршрут не выполняется.
export function sessionGuard(
  app: Elysia,
  access: ReturnType<typeof createAccess>,
): void {
  app.onBeforeHandle(async ({ request, set }) => {
    const session = await access.session(request.headers);
    const state = requestState(request);
    if (state) state.session = session;
    if (!session) {
      set.status = 401;
      if (state) state.errorCode = transportErrorCodes.UNAUTHORIZED;
      return {
        error: {
          code: transportErrorCodes.UNAUTHORIZED,
          requestId: set.headers['x-request-id'] ?? '',
        },
      };
    }
  });
}
