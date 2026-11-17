import type { Elysia } from 'elysia';

import type { createAccess } from '@anyko/backend/access';
import { AppError } from '@anyko/backend/errors';

import { requestState } from '../request-state';

// Временно (удаляется вместе с web #11): прежние пути без области в адресе работают с первым участием.
// Пользователь без участий получает 401, как и раньше.
export function legacyWorkspaceScopeGuard(
  app: Elysia,
  access: ReturnType<typeof createAccess>,
): void {
  app.onBeforeHandle(async ({ request }) => {
    const state = requestState(request);
    const session = state?.session;
    if (!state || !session) throw new Error('SESSION_NOT_RESOLVED');
    const scope = await access.legacyScope(session.user.id);
    if (!scope) throw new AppError('UNAUTHORIZED', 'unauthenticated');
    state.scope = scope;
  });
}
