import { expect, test } from 'bun:test';

import { QueryClient, QueryObserver } from '@tanstack/react-query';

import { invalidateLiveQueries, liveQuery } from './live-query';

test('refreshes an initial stale GET after it settles and limits notifications to the affected document', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  const pending = Promise.withResolvers<string>();
  let reads = 0;
  const observer = new QueryObserver(client, {
    queryKey: ['fixture', 'one'],
    meta: liveQuery('workspace', 'recognition-status', 'one'),
    queryFn: () =>
      ++reads === 1 ? pending.promise : Promise.resolve('succeeded'),
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    await invalidateLiveQueries(
      client,
      'workspace',
      ['recognition-status'],
      'two',
    );
    expect(reads).toBe(1);
    const refreshing = invalidateLiveQueries(
      client,
      'workspace',
      ['recognition-status'],
      'one',
    );
    pending.resolve('queued');
    await refreshing;
    expect(reads).toBe(2);
    expect(observer.getCurrentResult().data).toBe('succeeded');
  } finally {
    unsubscribe();
    client.clear();
  }
});
