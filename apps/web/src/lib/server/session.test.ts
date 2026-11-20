import { expect, mock, test } from 'bun:test';

import type { Session } from '@anyko/contracts/session';
import { DiagnosticError } from '@anyko/logger';

// Next подставляет маркер server-only в сборке; в тестах он пустой.
await mock.module('server-only', () => ({}));
const { readSession } = await import('@/lib/server/session');

// Форма v1: участия с правами; роль не приходит, право проверяется по списку.
const session: Session = {
  user: { id: 'user-1', name: 'Test', email: 'user@example.test' },
  memberships: [
    {
      workspace: { id: 'workspace-1', name: 'Workspace' },
      rights: ['works.read', 'works.create'],
    },
  ],
};
const cookie = 'better-auth.session_token=synthetic-fixture';

type Call = { url: string; init: RequestInit | undefined };

// Подмена сети на уровне fetch: проверяем, какой запрос уходит и как читается ответ.
function fakeFetch(respond: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetcher = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url:
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      init,
    });
    return Promise.resolve(respond());
  }) as typeof fetch;
  return { fetcher, calls };
}

test('a request without a session cookie is anonymous and makes no API call', async () => {
  const { fetcher, calls } = fakeFetch(() => Response.json(session));
  expect(await readSession(null, 'http://api.test', fetcher)).toBeNull();
  expect(await readSession('', 'http://api.test', fetcher)).toBeNull();
  expect(
    await readSession('theme=dark; other=1', 'http://api.test', fetcher),
  ).toBeNull();
  expect(calls).toEqual([]);
});

test('a 401 from the API means no session', async () => {
  const { fetcher } = fakeFetch(() =>
    Response.json(
      { error: { code: 'UNAUTHORIZED', requestId: 'request-1' } },
      { status: 401 },
    ),
  );
  expect(await readSession(cookie, 'http://api.test', fetcher)).toBeNull();
});

test('a valid session response is returned as parsed data', async () => {
  const { fetcher, calls } = fakeFetch(() => Response.json(session));
  expect(await readSession(cookie, 'http://api.test', fetcher)).toEqual(
    session,
  );
  expect(calls).toHaveLength(1);
  expect(calls[0]?.url).toBe('http://api.test/api/v1/session');
  expect(calls[0]?.init?.headers).toMatchObject({ cookie });
  expect(calls[0]?.init?.cache).toBe('no-store');
  expect(calls[0]?.init?.redirect).toBe('error');
  expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal);
});

// Пользователь без участий — обычная сессия: экран «Нет доступа» решает web, а не ошибка чтения.
test('a session without memberships is a session, not a failure', async () => {
  const withoutAccess = { ...session, memberships: [] };
  const { fetcher } = fakeFetch(() => Response.json(withoutAccess));
  expect(await readSession(cookie, 'http://api.test', fetcher)).toEqual(
    withoutAccess,
  );
});

test('the Secure session cookie name is recognised too', async () => {
  const secure = '__Secure-better-auth.session_token=synthetic-fixture';
  const { fetcher, calls } = fakeFetch(() => Response.json(session));
  expect(await readSession(secure, 'http://api.test', fetcher)).toEqual(
    session,
  );
  expect(calls).toHaveLength(1);
});

// Сообщение ошибки или признак успешного ответа: проверяем причину, а не сам факт исключения.
async function sessionFailure(
  promise: Promise<unknown>,
): Promise<DiagnosticError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof DiagnosticError) return error;
    throw error;
  }
  throw new Error('Expected a session diagnostic');
}

test('other API statuses are failures, not an anonymous visitor', async () => {
  for (const status of [403, 404, 500, 503]) {
    const { fetcher } = fakeFetch(() => new Response('{}', { status }));
    const error = await sessionFailure(
      readSession(cookie, 'http://api.test', fetcher),
    );
    expect(error.description).toMatchObject({
      code: 'SESSION_API_REJECTED',
      causeCode: `HTTP_${String(status)}`,
    });
  }
});

test('a network failure propagates', async () => {
  const { fetcher } = fakeFetch(() =>
    Promise.reject(new TypeError('fetch failed')),
  );
  const error = await sessionFailure(
    readSession(cookie, 'http://api.test', fetcher),
  );
  expect(error.description.code).toBe('SESSION_API_UNAVAILABLE');
  expect(Bun.inspect(error)).not.toContain('fetch failed');
});

test('a response that does not match the session contract is a failure', async () => {
  const { fetcher } = fakeFetch(() =>
    Response.json({ user: { id: 'user-1' }, workspace: 'workspace-1' }),
  );
  expect(
    (await sessionFailure(readSession(cookie, 'http://api.test', fetcher)))
      .description.code,
  ).toBe('SESSION_RESPONSE_INVALID');
});

// Прежняя форма `{ user, workspace }` без участий не проходит новую схему: её не принимаем молча.
test('the previous single-workspace shape is rejected by the v1 contract', async () => {
  const legacy = {
    user: session.user,
    workspace: { id: 'workspace-1', name: 'Workspace' },
  };
  const { fetcher } = fakeFetch(() => Response.json(legacy));
  expect(
    (await sessionFailure(readSession(cookie, 'http://api.test', fetcher)))
      .description.code,
  ).toBe('SESSION_RESPONSE_INVALID');
});
