import { afterEach, expect, spyOn, test } from 'bun:test';

import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { Component, type ReactNode } from 'react';

import { ApiError } from '@/lib/api/errors';
import { createQueryClient } from '@/lib/api/query-client';
import { sessionQueryOptions, useWorkspaceId } from '@/lib/api/session';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const session = {
  user: { id: 'user-1', name: 'Test', email: 'user@example.test' },
  workspace: { id: 'workspace-1', name: 'Workspace' },
};

// Дочерний экран, который читает область из сессии, как features.
function WorkspaceChild() {
  const workspaceId = useWorkspaceId();
  return <p>Рабочая область {workspaceId}</p>;
}

// Родитель повторяет решение Workspace: сессия есть — показываем экран, нет — вход.
function Screen() {
  const query = useQuery(sessionQueryOptions());
  if (query.isPending) return <p>Открываем</p>;
  if (!query.data) return <p>Нет сессии</p>;
  return <WorkspaceChild />;
}

class RenderBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <p>Ошибка рендера</p> : this.props.children;
  }
}

test('expiring the session while a screen is open shows sign-in without a render error', async () => {
  const urls: string[] = [];
  globalThis.fetch = ((input: RequestInfo | URL) => {
    urls.push(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    return Promise.resolve(Response.json(session));
  }) as typeof fetch;
  const consoleError = spyOn(console, 'error').mockImplementation(() => {
    /* a logged error fails the test below */
  });
  try {
    const client = createQueryClient();
    render(
      <QueryClientProvider client={client}>
        <RenderBoundary>
          <Screen />
        </RenderBoundary>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Рабочая область workspace-1')).toBeTruthy();
    expect(urls).toEqual(['/api/session']);

    // 401 приходит из запроса данных; обработчик кэша истекает сессию.
    await act(async () => {
      await client
        .query({
          queryKey: ['works', 'workspace-1', 'list'],
          queryFn: () =>
            Promise.reject(new ApiError('UNAUTHORIZED', 401, 'request-1')),
        })
        .catch(() => undefined);
    });

    expect(await screen.findByText('Нет сессии')).toBeTruthy();
    expect(screen.queryByText('Ошибка рендера')).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
  } finally {
    consoleError.mockRestore();
  }
});
