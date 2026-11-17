import { expect, test } from 'bun:test';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { createQueryClient } from '@/lib/api/query-client';
import { sessionKeys } from '@/lib/api/session';

import {
  installEventSource,
  json,
  networkError,
  serveApi,
} from '../../../../test/api';
import {
  session,
  titled,
  workAddress,
  workId,
  workspaceId,
  workView,
} from '../../../../test/fixtures';

import { useWorkView } from './use-work-view';

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

// Сервер отдаёт текущий ответ; тест меняет его, как меняется работа на сервере.
function serveWork(initial: Response | typeof networkError) {
  let current = initial;
  const exchanges = serveApi(() => current);
  return {
    exchanges,
    respond(next: Response | typeof networkError) {
      current = next;
    },
  };
}

test('loads the work from its API v1 address in the workspace and subscribes to its events', async () => {
  const sources = installEventSource();
  const server = serveWork(json(200, workView));
  const { result } = renderHook(() => useWorkView({ workspaceId, workId }), {
    wrapper: wrapperFor(createQueryClient()),
  });
  await waitFor(() => {
    expect(result.current.view?.work.title).toBe('Работа клиента');
  });
  await waitFor(() => {
    expect(sources).toHaveLength(1);
  });
  expect(server.exchanges.map((item) => item.url)).toEqual([workAddress]);
  expect(sources[0]?.url).toBe(`${workAddress}/events?after=0`);
  expect(result.current.loadError).toBe('');
});

test('a changed event refetches the work, so the screen shows what the server now holds', async () => {
  const sources = installEventSource();
  const server = serveWork(json(200, workView));
  const { result } = renderHook(() => useWorkView({ workspaceId, workId }), {
    wrapper: wrapperFor(createQueryClient()),
  });
  await waitFor(() => {
    expect(sources).toHaveLength(1);
  });
  server.respond(json(200, titled('Новое название')));
  act(() => {
    sources[0]?.emit('changed');
  });
  await waitFor(() => {
    expect(result.current.view?.work.title).toBe('Новое название');
  });
  expect(server.exchanges.map((item) => item.url)).toEqual([
    workAddress,
    workAddress,
  ]);
});

test('the live state follows the stream: open refetches and reports live, an error reports reconnecting', async () => {
  const sources = installEventSource();
  const server = serveWork(json(200, workView));
  const { result } = renderHook(() => useWorkView({ workspaceId, workId }), {
    wrapper: wrapperFor(createQueryClient()),
  });
  await waitFor(() => {
    expect(sources).toHaveLength(1);
  });
  expect(result.current.live).toBe('connecting');
  act(() => {
    sources[0]?.onopen?.();
  });
  await waitFor(() => {
    expect(result.current.live).toBe('live');
  });
  await waitFor(() => {
    expect(server.exchanges).toHaveLength(2);
  });
  act(() => {
    sources[0]?.onerror?.();
  });
  await waitFor(() => {
    expect(result.current.live).toBe('reconnecting');
  });
  await waitFor(() => {
    expect(server.exchanges).toHaveLength(3);
  });
  expect(sources).toHaveLength(1);
});

test('the stream closes when the screen leaves the work', async () => {
  const sources = installEventSource();
  serveWork(json(200, workView));
  const { unmount } = renderHook(() => useWorkView({ workspaceId, workId }), {
    wrapper: wrapperFor(createQueryClient()),
  });
  await waitFor(() => {
    expect(sources).toHaveLength(1);
  });
  unmount();
  expect(sources[0]?.closed).toBe(true);
});

test('a missing work reports not found and opens no stream', async () => {
  const sources = installEventSource();
  serveWork(json(404, {}));
  const client = createQueryClient();
  client.setQueryData(sessionKeys.all, session);
  const { result } = renderHook(() => useWorkView({ workspaceId, workId }), {
    wrapper: wrapperFor(client),
  });
  await waitFor(() => {
    expect(result.current.loadError).toBe('Работа не найдена.');
  });
  expect(result.current.view).toBeUndefined();
  expect(sources).toHaveLength(0);
  expect(client.getQueryData(sessionKeys.all)).toEqual(session);
});

test('a failed request other than not found reports a retryable load error', async () => {
  installEventSource();
  serveWork(networkError);
  const { result } = renderHook(() => useWorkView({ workspaceId, workId }), {
    wrapper: wrapperFor(createQueryClient()),
  });
  await waitFor(() => {
    expect(result.current.loadError).toBe(
      'Не удалось обновить работу. Повторите попытку.',
    );
  });
});

test('an unauthorized work request expires the session once and shows no load error', async () => {
  const sources = installEventSource();
  serveWork(json(401, {}));
  const client = createQueryClient();
  client.setQueryData(sessionKeys.all, session);
  const { result } = renderHook(() => useWorkView({ workspaceId, workId }), {
    wrapper: wrapperFor(client),
  });
  await waitFor(() => {
    expect(client.getQueryData(sessionKeys.all)).toBeNull();
  });
  expect(result.current.loadError).toBe('');
  expect(result.current.view).toBeUndefined();
  expect(sources).toHaveLength(0);
});
