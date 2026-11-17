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
  if (decision.action === 'redirect')
    return NextResponse.redirect(new URL(decision.location, request.url));
  const response = NextResponse.next();
  if (decision.lastWorkspace !== undefined)
    response.cookies.set(lastWorkspaceCookie, decision.lastWorkspace, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: request.nextUrl.protocol === 'https:',
      maxAge: LAST_WORKSPACE_MAX_AGE,
    });
  return response;
}

// Статика, API-прокси и сама страница входа не проходят через проверку.
export const config = {
  matcher: [
    '/((?!api/|api$|_next/|brand/|sign-in$|sign-in/|favicon\\.ico$|.*\\.svg$|.*\\.png$|.*\\.ico$|.*\\.ttf$|.*\\.txt$).*)',
  ],
};
