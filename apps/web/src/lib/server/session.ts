import 'server-only';
import { headers } from 'next/headers';
import { cache } from 'react';

import {
  type Session,
  sessionCookieNames,
  sessionResponseSchema,
} from '@anyko/contracts/session';

import { readServerConfig } from '@/lib/server/config';

const SESSION_TIMEOUT_MS = 10_000;

function hasSessionCookie(cookieHeader: string) {
  return cookieHeader.split(';').some((pair) => {
    const separator = pair.indexOf('=');
    return (
      separator > 0 &&
      (sessionCookieNames as readonly string[]).includes(
        pair.slice(0, separator).trim(),
      )
    );
  });
}

// Читает сессию у API с cookie пользователя. null означает «сессии нет» (нет cookie или 401);
// остальные исходы — сбой, который экран покажет как недоступность сервера.
export async function readSession(
  cookieHeader: string | null,
  origin: string,
  fetcher: typeof fetch = fetch,
): Promise<Session | null> {
  if (!cookieHeader || !hasSessionCookie(cookieHeader)) return null;
  // Серверный запрос идёт прямо к API (без прокси web), поэтому путь версии задан здесь явно.
  const response = await fetcher(`${origin}/api/v1/session`, {
    headers: { cookie: cookieHeader, accept: 'application/json' },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
  });
  if (response.status === 401) {
    await response.body?.cancel();
    return null;
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      `Session request failed with status ${String(response.status)}`,
    );
  }
  const parsed = sessionResponseSchema.safeParse(await response.json());
  if (!parsed.success)
    throw new Error('Session response does not match the contract');
  return parsed.data;
}

// Один запрос сессии на отрисовку: layout, страница и корневой маршрут получают одно значение.
export const getSession = cache(async () =>
  readSession((await headers()).get('cookie'), readServerConfig().API_ORIGIN),
);
