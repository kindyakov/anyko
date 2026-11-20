import type { WorkspaceScope } from '@anyko/backend/scope';
import type { Session } from '@anyko/contracts/session';

// Состояние одного запроса: заполняют plugins, читают маршруты. Ключ — объект Request,
// поэтому состояние живёт ровно столько, сколько запрос, и не попадает в журнал.
export interface RequestState {
  readonly requestId: string;
  readonly correlationId: string;
  readonly startedAt: number;
  errorCode?: string;
  // Заполняется plugin session один раз на запрос; null — сессии нет (ответ 401 уже отправлен).
  session: Session | null | undefined;
  // Доверенная область: plugin workspace-scope (адрес) или временный слой (первое участие).
  scope: WorkspaceScope | undefined;
}

const states = new WeakMap<Request, RequestState>();

export function attachRequestState(
  request: Request,
  requestId: string,
  correlationId: string,
) {
  states.set(request, {
    requestId,
    correlationId,
    startedAt: performance.now(),
    session: undefined,
    scope: undefined,
  });
}

export function requestState(request: Request): RequestState | undefined {
  return states.get(request);
}
