import { expect, test } from 'bun:test';

import { QueryClient, QueryObserver } from '@tanstack/react-query';

import { expireSession } from '@/features/auth/session-cache';

test('logout notifies the mounted session observer and removes private cached data', () => {
  const client = new QueryClient();
  client.setQueryData(['session'], { user: { id: 'previous-user' } });
  client.setQueryData(['works'], ['private work']);
  const observer = new QueryObserver(client, {
    queryKey: ['session'],
    enabled: false,
  });
  const unsubscribe = observer.subscribe(() => undefined);
  expireSession(client);
  expect(observer.getCurrentResult().data).toBeNull();
  expect(client.getQueryData(['works'])).toBeUndefined();
  unsubscribe();
  client.clear();
});
