import { afterEach, expect, test } from 'bun:test';

import { QueryObserver } from '@tanstack/react-query';

import { ApiError } from '@/lib/api/errors';
import { createQueryClient } from '@/lib/api/query-client';
import { sessionKeys, sessionQueryOptions } from '@/lib/api/session';

const originalFetch = globalThis.fetch;
const session = {
  user: { id: 'previous-user', name: 'Previous', email: 'a@example.test' },
  workspace: { id: 'workspace-1', name: 'Workspace' },
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('401 from a data request ends the session and removes other cached data', async () => {
  const client = createQueryClient();
  client.setQueryData(sessionKeys.all, session);
  client.setQueryData(['works', 'workspace-1', 'list'], ['private work']);
  const observer = new QueryObserver(client, {
    queryKey: sessionKeys.all,
    enabled: false,
  });
  const unsubscribe = observer.subscribe(() => undefined);
  await client
    .query({
      queryKey: ['document-packages', 'workspace-1', 'list'],
      queryFn: () =>
        Promise.reject(new ApiError('UNAUTHORIZED', 401, 'request-1')),
    })
    .catch(() => undefined);
  expect(observer.getCurrentResult().data).toBeNull();
  expect(client.getQueryData(['works', 'workspace-1', 'list'])).toBeUndefined();
  unsubscribe();
  client.clear();
});

test('a server failure keeps the session and cached data', async () => {
  const client = createQueryClient();
  client.setQueryData(sessionKeys.all, session);
  client.setQueryData(['works', 'workspace-1', 'list'], ['private work']);
  await client
    .query({
      queryKey: ['document-packages', 'workspace-1', 'list'],
      queryFn: () =>
        Promise.reject(new ApiError('INTERNAL_ERROR', 500, 'request-2')),
    })
    .catch(() => undefined);
  expect(client.getQueryData(sessionKeys.all)).toEqual(session);
  expect(client.getQueryData(['works', 'workspace-1', 'list'])).toEqual([
    'private work',
  ]);
  client.clear();
});

test('a 401 on the session request itself resolves to no session without clearing data', async () => {
  const urls: string[] = [];
  globalThis.fetch = ((input: RequestInfo | URL) => {
    urls.push(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    return Promise.resolve(
      Response.json(
        { error: { code: 'UNAUTHORIZED', requestId: 'request-3' } },
        { status: 401 },
      ),
    );
  }) as typeof fetch;
  const client = createQueryClient();
  client.setQueryData(['works', 'workspace-1', 'list'], ['private work']);
  const current = await client.query(sessionQueryOptions());
  expect(urls).toEqual(['/api/session']);
  expect(current).toBeNull();
  expect(client.getQueryData(['works', 'workspace-1', 'list'])).toEqual([
    'private work',
  ]);
  client.clear();
});
