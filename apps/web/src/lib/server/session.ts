import 'server-only';
import { headers } from 'next/headers';
import { cache } from 'react';

import {
  type Session,
  sessionCookieNames,
  sessionResponseSchema,
} from '@anyko/contracts/session';
import { DiagnosticError } from '@anyko/logger';

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
  correlationId = crypto.randomUUID(),
): Promise<Session | null> {
  if (!cookieHeader || !hasSessionCookie(cookieHeader)) return null;
  // Серверный запрос идёт прямо к API (без прокси web), поэтому путь версии задан здесь явно.
  const operation = 'web.readSession';
  const response = await fetcher(`${origin}/api/v1/session`, {
    headers: {
      cookie: cookieHeader,
      accept: 'application/json',
      'x-correlation-id': correlationId,
    },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
  }).catch((cause: unknown) => {
    throw new DiagnosticError(
      {
        code: 'SESSION_API_UNAVAILABLE',
        message: 'Не удалось связаться с API для проверки сессии.',
        operation,
      },
      { cause },
    );
  });
  if (response.status === 401) {
    await response.body?.cancel();
    return null;
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new DiagnosticError({
      code: 'SESSION_API_REJECTED',
      message: 'API вернул ошибку при проверке сессии.',
      operation,
      causeCode: `HTTP_${String(response.status)}`,
    });
  }
  const payload: unknown = await response.json().catch(() => undefined);
  const parsed = sessionResponseSchema.safeParse(payload);
  if (!parsed.success)
    throw new DiagnosticError({
      code: 'SESSION_RESPONSE_INVALID',
      message: 'Ответ API о сессии не соответствует контракту.',
      operation,
    });
  return parsed.data;
}

// Один запрос сессии на отрисовку: layout, страница и корневой маршрут получают одно значение.
export const getSession = cache(async () => {
  const incoming = await headers();
  return readSession(
    incoming.get('cookie'),
    readServerConfig().API_ORIGIN,
    fetch,
    incoming.get('x-correlation-id') ?? undefined,
  );
});
