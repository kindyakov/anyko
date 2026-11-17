import { afterEach, expect, test } from 'bun:test';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import type { Session } from '@anyko/contracts/session';

import { createQueryClient } from '@/lib/api/query-client';
import { sessionKeys } from '@/lib/api/session';

import { useWorkView } from './use-work-view';

const originalFetch = globalThis.fetch;
const originalEventSource = globalThis.EventSource;

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.EventSource = originalEventSource;
});

const workId = '0b6f4e3a-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
const session: Session = {
  user: { id: 'user-1', name: 'Test', email: 'user@example.test' },
  memberships: [
    {
      workspace: { id: 'workspace-1', name: 'Workspace' },
      rights: ['works.read', 'works.edit'],
    },
  ],
};

// Минимальный вид работы, который проходит workResponseSchema из contracts.
const workView = {
  work: {
    id: workId,
    title: 'Работа клиента',
    packageVersion: 'v1',
    revision: 1,
    inputRevision: 0,
    confirmedRevision: null,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
  },
  package: {
    id: 'package-1',
    version: 'v1',
    title: 'Пакет',
    technical: false,
    fields: [],
    documents: [
      {
        id: 'template-1',
        version: 'v1',
        title: 'Шаблон',
        filename: 'template.docx',
        checksum: 'a'.repeat(64),
        blocks: [],
      },
    ],
  },
  documents: [],
  facts: { version: 1, values: {}, manual: [], confirmed: [], candidates: [] },
  runs: [],
  generations: [],
  cursor: '0',
  cleanupPending: false,
};

// Сеть подменяется на уровне fetch: все запросы получают один и тот же ответ.
function answerWith(status: number, body: unknown) {
  const requested: string[] = [];
  globalThis.fetch = ((input: RequestInfo | URL) => {
    requested.push(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  }) as typeof fetch;
  return requested;
}

// Поток событий не нужен этим проверкам: хук только открывает его и закрывает.
function silentEvents() {
  globalThis.EventSource = class {
    addEventListener() {
      /* events are not delivered in these tests */
    }
    close() {
      /* nothing to close */
    }
  } as unknown as typeof EventSource;
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

test('loads the work, reports it to the caller and reads it from the work address', async () => {
  silentEvents();
  const requested = answerWith(200, workView);
  const loaded: string[] = [];
  const client = createQueryClient();
  const { result } = renderHook(
    () =>
      useWorkView({
        workId,
        onLoaded: (view) => {
          loaded.push(view.work.title);
        },
      }),
    { wrapper: wrapperFor(client) },
  );
  await waitFor(() => {
    expect(result.current.view?.work.title).toBe('Работа клиента');
  });
  await act(async () => {
    await result.current.load();
  });
  expect(loaded).toEqual(['Работа клиента']);
  expect(result.current.loadError).toBe('');
  expect(requested[0]).toBe(`/api/works/${workId}`);
});

test('reports a missing work without expiring the session', async () => {
  silentEvents();
  answerWith(404, {});
  const client = createQueryClient();
  client.setQueryData(sessionKeys.all, session);
  const { result } = renderHook(
    () => useWorkView({ workId, onLoaded: () => undefined }),
    { wrapper: wrapperFor(client) },
  );
  await waitFor(() => {
    expect(result.current.loadError).toBe('Работа не найдена.');
  });
  expect(result.current.view).toBeUndefined();
  expect(client.getQueryData(sessionKeys.all)).toEqual(session);
});

test('an unauthorized work request expires the session once and shows no load error', async () => {
  silentEvents();
  answerWith(401, {});
  const client = createQueryClient();
  client.setQueryData(sessionKeys.all, session);
  const { result } = renderHook(
    () => useWorkView({ workId, onLoaded: () => undefined }),
    { wrapper: wrapperFor(client) },
  );
  await waitFor(() => {
    expect(client.getQueryData(sessionKeys.all)).toBeNull();
  });
  expect(result.current.loadError).toBe('');
  expect(result.current.view).toBeUndefined();
});
