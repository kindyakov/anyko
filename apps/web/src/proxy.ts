import { type NextRequest, NextResponse } from 'next/server';

import { lastWorkspaceCookie, sessionGate } from '@/lib/session-gate';

const LAST_WORKSPACE_MAX_AGE = 60 * 60 * 24 * 30;

// Оптимистичная проверка на границе запроса: без cookie сессии вход, иначе запоминаем область.
// Защитой доступа это не считается: решение принимает API, а маршруты читают сессию у него.
export function proxy(request: NextRequest) {
  const decision = sessionGate({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    cookieNames: request.cookies.getAll().map((cookie) => cookie.name),
    lastWorkspace: request.cookies.get(lastWorkspaceCookie)?.value,
  });
  const signIn =
    request.nextUrl.pathname === '/sign-in' ||
    request.nextUrl.pathname.startsWith('/sign-in/');
  if (!signIn && decision.action === 'redirect')
    return NextResponse.redirect(new URL(decision.location, request.url));
  const correlationId = crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set('x-correlation-id', correlationId);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('x-correlation-id', correlationId);
  if (decision.action === 'continue' && decision.lastWorkspace !== undefined)
    response.cookies.set(lastWorkspaceCookie, decision.lastWorkspace, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: request.nextUrl.protocol === 'https:',
      maxAge: LAST_WORKSPACE_MAX_AGE,
    });
  return response;
}

// API-прокси сам назначает correlation ID. Статике он не нужен.
export const config = {
  matcher: [
    '/((?!api/|api$|_next/|brand/|pdf-assets/|favicon\\.ico$|.*\\.svg$|.*\\.png$|.*\\.ico$|.*\\.ttf$|.*\\.txt$).*)',
  ],
};
