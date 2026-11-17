import '../../../../../../test/next-navigation';
import { afterEach, expect, test } from 'bun:test';

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Membership, Right, Session } from '@anyko/contracts/session';

import { createQueryClient } from '@/lib/api/query-client';
import { sessionKeys } from '@/lib/api/session';
import { routes } from '@/lib/routes';

import { navigation } from '../../../../../../test/next-navigation';

import { AppShell } from './app-shell';

afterEach(() => {
  navigation.reset();
});

const user = { id: 'user-1', name: 'Test', email: 'user@example.test' };

function member(id: string, name: string, rights: Right[]): Membership {
  return { workspace: { id, name }, rights };
}

// Оболочка получает сессию из кэша, как после гидратации в layout; адрес задаёт текущую область.
function renderShell(memberships: Membership[], active: string) {
  navigation.params = { workspace: active };
  navigation.pathname = `/w/${active}/works`;
  const client = createQueryClient();
  const session: Session = { user, memberships };
  client.setQueryData(sessionKeys.all, session);
  render(
    <QueryClientProvider client={client}>
      <AppShell>
        <p>Содержимое раздела</p>
      </AppShell>
    </QueryClientProvider>,
  );
}

test('a single workspace is shown by its name, without a switcher menu', async () => {
  renderShell([member('workspace-1', 'Первая', ['works.read'])], 'workspace-1');

  expect(await screen.findByText('Содержимое раздела')).toBeTruthy();
  expect(screen.getByText('Первая')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Первая' })).toBeNull();
});

test('several workspaces open a menu of links to each one, and the current one is marked', async () => {
  renderShell(
    [
      member('workspace-1', 'Первая', ['works.read']),
      member('workspace-2', 'Вторая', ['works.read']),
    ],
    'workspace-1',
  );
  const person = userEvent.setup();

  await person.click(await screen.findByRole('button', { name: 'Первая' }));
  const items = await screen.findAllByRole('menuitem');

  expect(items.map((item) => item.textContent)).toEqual(['Первая', 'Вторая']);
  expect(items[0]?.getAttribute('href')).toBe(routes.works('workspace-1'));
  expect(items[1]?.getAttribute('href')).toBe(routes.works('workspace-2'));
  expect(items[0]?.getAttribute('aria-current')).toBe('true');
  expect(items[1]?.hasAttribute('aria-current')).toBe(false);
});

test('the workspace settings link is offered only with the connections read right', async () => {
  renderShell([member('workspace-1', 'Первая', ['works.read'])], 'workspace-1');

  expect(await screen.findByText('Содержимое раздела')).toBeTruthy();
  expect(
    screen.queryAllByRole('link', { name: 'Настройки пространства' }),
  ).toHaveLength(0);
});

test('with the connections read right the settings link points to the current workspace', async () => {
  renderShell(
    [member('workspace-1', 'Первая', ['connections.read'])],
    'workspace-1',
  );

  expect(await screen.findByText('Содержимое раздела')).toBeTruthy();
  const links = screen.getAllByRole('link', { name: 'Настройки пространства' });
  expect(links.length).toBeGreaterThan(0);
  for (const link of links)
    expect(link.getAttribute('href')).toBe(routes.connections('workspace-1'));
});
