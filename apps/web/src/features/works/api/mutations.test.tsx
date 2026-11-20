import { expect, test } from 'bun:test';

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { newIdempotencyKey } from '@/lib/api/call';
import { createQueryClient } from '@/lib/api/query-client';

import { json, networkError, serveApi } from '../../../../test/api';
import {
  workAddress,
  workId,
  workspaceId,
  workView,
} from '../../../../test/fixtures';

import { useAnalyzeWork, useConfirmWork, useCreateWork } from './mutations';
import { workQueryOptions } from './queries';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

// Экран держит вид работы активным запросом; команда после успеха должна его обновить.
function renderCommands(client: QueryClient) {
  return renderHook(
    () => ({
      view: useQuery(workQueryOptions(workspaceId, workId)),
      analyze: useAnalyzeWork(workspaceId, workId),
      confirm: useConfirmWork(workspaceId, workId),
    }),
    { wrapper: wrapperFor(client) },
  );
}

test.each([
  ['NETWORK_ERROR', networkError],
  [
    'IDEMPOTENCY_IN_PROGRESS',
    json(409, {
      error: { code: 'IDEMPOTENCY_IN_PROGRESS', requestId: 'request-1' },
    }),
  ],
] as const)(
  'analyze reuses its key after %s and starts a new action after success',
  async (code, interrupted) => {
    let posts = 0;
    const exchanges = serveApi((exchange) => {
      if (exchange.method === 'GET') return json(200, workView);
      posts++;
      return posts === 1 ? interrupted : json(202, { status: 'queued' });
    });
    const { result } = renderCommands(createQueryClient());
    await waitFor(() => {
      expect(result.current.view.data).toBeDefined();
    });

    let failure: unknown;
    await result.current.analyze.mutateAsync().catch((error: unknown) => {
      failure = error;
    });
    expect(failure).toMatchObject({ code });
    await result.current.analyze.mutateAsync();
    await result.current.analyze.mutateAsync();

    const analyzed = exchanges.filter((item) => item.method === 'POST');
    expect(analyzed.map((item) => item.url)).toEqual([
      `${workAddress}/analyze`,
      `${workAddress}/analyze`,
      `${workAddress}/analyze`,
    ]);
    expect(analyzed[0]?.idempotencyKey).toMatch(uuid);
    expect(analyzed[1]?.idempotencyKey).toBe(analyzed[0]?.idempotencyKey);
    expect(analyzed[2]?.idempotencyKey).toMatch(uuid);
    expect(analyzed[2]?.idempotencyKey).not.toBe(analyzed[0]?.idempotencyKey);
    // Две успешные команды обновили вид работы: одна загрузка при открытии и по одной после каждой.
    expect(exchanges.filter((item) => item.method === 'GET')).toHaveLength(3);
  },
);

test('confirm sends the revision it was given and no idempotency key, then refreshes the work', async () => {
  const exchanges = serveApi((exchange) =>
    exchange.method === 'GET'
      ? json(200, workView)
      : json(200, {
          ...workView,
          work: { ...workView.work, confirmedRevision: 1 },
        }),
  );
  const { result } = renderCommands(createQueryClient());
  await waitFor(() => {
    expect(result.current.view.data).toBeDefined();
  });
  await result.current.confirm.mutateAsync({ revision: 1 });
  const confirmed = exchanges.find((item) => item.method === 'POST');
  expect(confirmed?.url).toBe(`${workAddress}/confirm`);
  expect(confirmed?.body).toEqual({ revision: 1 });
  expect(confirmed?.idempotencyKey).toBeNull();
  expect(exchanges.filter((item) => item.method === 'GET')).toHaveLength(2);
});

test('creating a work sends the key in its header and only the work fields in the body', async () => {
  const exchanges = serveApi(() => json(201, workView));
  const { result } = renderHook(() => useCreateWork(workspaceId), {
    wrapper: wrapperFor(createQueryClient()),
  });
  const key = newIdempotencyKey();
  await result.current.mutateAsync({
    title: 'Новая работа',
    packageVersion: 'v1',
    idempotencyKey: key,
  });
  const created = exchanges[0];
  expect(created?.url).toBe(`/api/v1/workspaces/${workspaceId}/works`);
  expect(created?.idempotencyKey).toBe(key);
  expect(created?.body).toEqual({
    title: 'Новая работа',
    packageVersion: 'v1',
  });
});
