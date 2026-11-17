import { sessionCookieNames } from '@anyko/contracts/session';

import { routes } from '@/lib/routes';

// Cookie без секретов: последняя открытая рабочая область, по которой `/` выбирает адрес.
export const lastWorkspaceCookie = 'anyko-last-workspace';

const workspacePath = /^\/w\/([^/]+)(?:\/|$)/;
const workspaceId = /^[\w-]{1,128}$/;

export type GateInput = {
  pathname: string;
  search: string;
  cookieNames: readonly string[];
  lastWorkspace: string | undefined;
};

export type GateDecision =
  | { action: 'redirect'; location: string }
  | { action: 'continue'; lastWorkspace?: string };

// Оптимистичная проверка без обращения к API: только наличие cookie сессии.
// Истёкшую или отозванную сессию отклоняет API и маршруты (см. lib/server/session.ts).
export function sessionGate(input: GateInput): GateDecision {
  const hasSession = input.cookieNames.some((name) =>
    (sessionCookieNames as readonly string[]).includes(name),
  );
  if (!hasSession)
    return {
      action: 'redirect',
      location: routes.signIn(`${input.pathname}${input.search}`),
    };
  const match = workspacePath.exec(input.pathname);
  const id = match?.[1] ? decodeSegment(match[1]) : undefined;
  if (id === undefined || !workspaceId.test(id)) return { action: 'continue' };
  return id === input.lastWorkspace
    ? { action: 'continue' }
    : { action: 'continue', lastWorkspace: id };
}

function decodeSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}
