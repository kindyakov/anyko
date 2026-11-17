import '../../../../../../test/next-navigation';
import { afterEach, expect, spyOn, test } from 'bun:test';

import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { Component, type ReactNode } from 'react';

import { ApiError } from '@/lib/api/errors';
import { createQueryClient } from '@/lib/api/query-client';
import { sessionKeys } from '@/lib/api/session';

import { navigation } from '../../../../../../test/next-navigation';

import { AppShell } from './app-shell';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  navigation.reset();
});

const session = {
  user: { id: 'user-1', name: 'Test', email: 'user@example.test' },
  workspace: { id: 'workspace-1', name: 'Workspace' },
};

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

// Оболочка получает сессию из кэша (как после гидратации в layout). Истечение сессии из запроса
// данных должно вернуть на вход по текущему адресу, без ошибки рендера.
test('expiring the session from a data request returns the workspace page to sign-in', async () => {
  navigation.params = { workspace: 'workspace-1' };
  navigation.pathname = '/w/workspace-1/works';
  const requested: string[] = [];
  globalThis.fetch = ((input: RequestInfo | URL) => {
    requested.push(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    return Promise.reject(new Error('the shell must not refetch'));
  }) as typeof fetch;
  const consoleError = spyOn(console, 'error').mockImplementation(() => {
    /* a logged error fails the test below */
  });
  try {
    const client = createQueryClient();
    client.setQueryData(sessionKeys.all, session);
    render(
      <QueryClientProvider client={client}>
        <RenderBoundary>
          <AppShell>
            <p>Содержимое раздела</p>
          </AppShell>
        </RenderBoundary>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Содержимое раздела')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: /Работы/ }).getAttribute('href'),
    ).toBe('/w/workspace-1/works');
    expect(navigation.calls).toEqual([]);
    expect(requested).toEqual([]);

    // 401 приходит из запроса данных; обработчик кэша истекает сессию, оболочка уводит на вход.
    await act(async () => {
      await client
        .query({
          queryKey: ['works', 'workspace-1', 'list'],
          queryFn: () =>
            Promise.reject(new ApiError('UNAUTHORIZED', 401, 'request-1')),
        })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(navigation.calls).toEqual([
        {
          method: 'replace',
          href: '/sign-in?next=%2Fw%2Fworkspace-1%2Fworks',
        },
      ]);
    });
    expect(screen.queryByText('Ошибка рендера')).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
  } finally {
    consoleError.mockRestore();
  }
});
