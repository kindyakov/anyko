import type { Elysia } from 'elysia';

import type { createAccess } from '@anyko/backend/access';
import { AppError } from '@anyko/backend/errors';

import { requestState } from '../request-state';

// Область из адреса `/workspaces/:workspaceId/...`: участие проверяет access, чужая или
// несуществующая область даёт NOT_FOUND. Plugin стоит после сессии и origin и до разбора входа,
// поэтому тело чужого запроса не читается и существование области не раскрывается.
export function workspaceScopeGuard(
  app: Elysia,
  access: ReturnType<typeof createAccess>,
): void {
  app.onBeforeHandle(({ request, params }) => {
    // У маршрута без параметров пути Elysia не передаёт params: это не ошибка, а отсутствие адреса.
    const workspaceId = (
      params as Record<string, string | undefined> | undefined
    )?.workspaceId;
    if (workspaceId === undefined) return;
    const state = requestState(request);
    const session = state?.session;
    if (!state || !session) throw new Error('SESSION_NOT_RESOLVED');
    const scope = access.scope(session, workspaceId);
    if (!scope) throw new AppError('NOT_FOUND', 'not_found');
    state.scope = scope;
  });
}
