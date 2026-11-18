import '../../../../test/next-navigation';
import { afterEach, expect, test } from 'bun:test';

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Right, Session } from '@anyko/contracts/session';
import { ToastProvider } from '@anyko/ui';

import { createQueryClient } from '@/lib/api/query-client';
import { sessionKeys } from '@/lib/api/session';
import { routes } from '@/lib/routes';

import { serveApi } from '../../../../test/api';
import { expectFocused } from '../../../../test/focus';
import { navigation } from '../../../../test/next-navigation';

import { WorkList } from './work-list';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  navigation.reset();
});

const workId = '11111111-1111-4111-8111-111111111111';
const createdId = '22222222-2222-4222-8222-222222222222';
const worksAddress = '/api/v1/workspaces/workspace-1/works';
const worksFirstPage = `${worksAddress}?page=1`;
const documentPackagesAddress = '/api/v1/document-packages';
const template = {
  id: 'doc-1',
  version: '1',
  title: 'Заявление',
  filename: 'application.docx',
  checksum: 'a'.repeat(64),
  blocks: [],
};
const packages = [
  {
    id: 'pkg-1',
    version: '2026.1',
    title: 'Банкротство физлица',
    technical: false,
    fields: [],
    documents: [template],
  },
  {
    id: 'pkg-2',
    version: 'test-1',
    title: 'Тестовый бланк',
    technical: true,
    fields: [],
    documents: [template],
  },
];
const existingWork = {
  id: workId,
  title: 'Иванов',
  packageVersion: '2026.1',
  revision: 1,
  inputRevision: 1,
  confirmedRevision: null,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
};
const createdWorkView = {
  work: { ...existingWork, id: createdId, title: 'Петров' },
  session: null,
  package: packages[1],
  documents: [],
  facts: {
    version: 1,
    values: {},
    manual: [],
    confirmed: [],
    discrepancyFields: [],
    candidates: [],
  },
  runs: [],
  generations: [],
  cursor: '0',
  cleanupPending: false,
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Сеть подменяется на уровне fetch: список и шаблоны — постоянные, ответ на создание задаётся тестом.
function serveWorkList(creation: { status: number; body: unknown }) {
  const requests: { method: string; url: string; body: unknown }[] = [];
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const method = init?.method ?? 'GET';
    const body: unknown =
      typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    requests.push({ method, url, body });
    if (method === 'POST')
      return Promise.resolve(json(creation.status, creation.body));
    if (url === documentPackagesAddress)
      return Promise.resolve(json(200, { packages }));
    if (url === worksFirstPage)
      return Promise.resolve(
        json(200, {
          items: [existingWork],
          page: 1,
          pageSize: 24,
          total: 1,
          deletions: [],
        }),
      );
    return Promise.resolve(json(404, {}));
  }) as typeof fetch;
  return requests;
}

// Права текущей области приходят из кэша сессии; по умолчанию создание доступно.
function renderWorkList(rights: Right[] = ['works.read', 'works.create']) {
  navigation.params = { workspace: 'workspace-1' };
  const session: Session = {
    user: { id: 'user-1', name: 'Test', email: 'user@example.test' },
    memberships: [
      { workspace: { id: 'workspace-1', name: 'Workspace' }, rights },
    ],
  };
  const client = createQueryClient();
  client.setQueryData(sessionKeys.all, session);
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <WorkList />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

async function openCreateDialog() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Новая работа' }));
  return user;
}

// Без права создания действие не предлагается ни в шапке, ни в пустом списке; список при этом виден.
test('without the create right no creation button is offered, the list still shows', async () => {
  const requests = serveWorkList({ status: 201, body: createdWorkView });
  renderWorkList(['works.read']);

  expect(
    await screen.findByRole('list', { name: 'Список работ' }),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Новая работа' })).toBeNull();
  expect(requests.filter((request) => request.method === 'POST')).toEqual([]);
  // Список и каталог читаются по адресам API v1: список — в области рабочего пространства.
  expect(requests.map((request) => request.url).sort()).toEqual(
    [documentPackagesAddress, worksFirstPage].sort(),
  );
});

test('an empty list hides pagination and respects the create right', async () => {
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url === documentPackagesAddress)
      return Promise.resolve(json(200, { packages }));
    if (url === worksFirstPage)
      return Promise.resolve(
        json(200, {
          items: [],
          page: 1,
          pageSize: 24,
          total: 0,
          deletions: [],
        }),
      );
    return Promise.resolve(json(404, {}));
  }) as typeof fetch;
  renderWorkList(['works.read']);

  expect(
    await screen.findByRole('heading', { name: 'Начните с первой работы' }),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Создать работу' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Новая работа' })).toBeNull();
  expect(
    screen.queryByRole('navigation', { name: 'Страницы работ' }),
  ).toBeNull();
});

test('the title field gets focus when the create dialog opens', async () => {
  serveWorkList({ status: 201, body: createdWorkView });
  renderWorkList();
  await openCreateDialog();

  const title = await screen.findByLabelText('Название работы');
  await waitFor(() => {
    expectFocused(title);
  });
});

test('shows pagination with both arrows disabled for one work', async () => {
  serveWorkList({ status: 201, body: createdWorkView });
  renderWorkList();
  const pager = within(
    await screen.findByRole('navigation', { name: 'Страницы работ' }),
  );
  expect(pager.getByText('Найдено работ: 1')).toBeTruthy();
  expect(
    pager.getByRole('button', { name: 'Страница 1', current: 'page' }),
  ).toBeTruthy();
  for (const name of ['Предыдущая страница', 'Следующая страница'])
    expect(pager.getByRole('button', { name }).hasAttribute('disabled')).toBe(
      true,
    );
});

test('a linked filter and page size are sent to the server and changing size resets the page', async () => {
  navigation.search = 'q=Иван&status=confirmed&page=2&pageSize=12&view=list';
  const requests = serveApi(({ url }) =>
    url === documentPackagesAddress
      ? json(200, { packages })
      : json(200, {
          items: [existingWork],
          page: 2,
          pageSize: 12,
          total: 25,
          deletions: [],
        }),
  );
  renderWorkList();
  expect(await screen.findByText('Найдено работ: 25')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Страница 2', current: 'page' }),
  ).toBeTruthy();
  expect(requests.map(({ url }) => url)).toContain(
    `${worksAddress}?page=2&pageSize=12&q=%D0%98%D0%B2%D0%B0%D0%BD&status=confirmed`,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: 'Вид списка работ' }));
  await user.click(await screen.findByRole('option', { name: 'Плитка' }));
  expect(navigation.calls).toContainEqual({
    method: 'replace',
    href: '/w/workspace-1/works?q=%D0%98%D0%B2%D0%B0%D0%BD&status=confirmed&page=2&pageSize=12',
  });
  await user.click(screen.getByRole('combobox', { name: 'Работ на странице' }));
  await user.click(await screen.findByRole('option', { name: '6' }));
  expect(navigation.calls).toContainEqual({
    method: 'push',
    href: '/w/workspace-1/works?q=%D0%98%D0%B2%D0%B0%D0%BD&status=confirmed&pageSize=6&view=list',
  });
});

test('an authorized owner must confirm before the work is deleted', async () => {
  let available = true;
  const requests = serveApi(({ method, url }) => {
    if (url === documentPackagesAddress) return json(200, { packages });
    if (method === 'DELETE') {
      available = false;
      return json(202, { status: 'deleting' });
    }
    if (url.endsWith('/deletion')) return json(200, { status: 'deleted' });
    return json(200, {
      items: available ? [existingWork] : [],
      page: 1,
      pageSize: 24,
      total: available ? 1 : 0,
      deletions: [],
    });
  });
  const user = userEvent.setup();
  renderWorkList(['works.read', 'works.delete']);
  const action = await screen.findByRole('button', {
    name: 'Действия с работой «Иванов»',
  });
  await user.click(action);
  await user.click(screen.getByRole('menuitem', { name: 'Удалить' }));
  const dialog = within(
    screen.getByRole('alertdialog', { name: 'Удалить работу «Иванов»?' }),
  );
  expect(requests.some(({ method }) => method === 'DELETE')).toBe(false);
  await user.click(dialog.getByRole('button', { name: 'Удалить работу' }));
  const notifications = within(
    screen.getByRole('region', { name: 'Уведомления' }),
  );
  expect(
    await notifications.findByText('Работа «Иванов» и её файлы удалены.'),
  ).toBeTruthy();
  expect(screen.queryByRole('link', { name: /Иванов/ })).toBeNull();
  expect(
    requests.filter(({ method }) => method === 'DELETE').map(({ url }) => url),
  ).toEqual([`${worksAddress}/${workId}`]);
});

test('an empty title is refused on the client, nothing is sent and the title is focused', async () => {
  const requests = serveWorkList({ status: 201, body: createdWorkView });
  renderWorkList();
  const user = await openCreateDialog();

  await user.click(
    await screen.findByRole('button', { name: 'Создать и открыть' }),
  );

  expect(await screen.findByText('Введите название работы')).toBeTruthy();
  expect(
    screen.getByLabelText('Название работы').getAttribute('aria-invalid'),
  ).toBe('true');
  expectFocused(screen.getByLabelText('Название работы'));
  expect(requests.filter((request) => request.method === 'POST')).toEqual([]);
});

test('the chosen package and title are sent and the new work is opened', async () => {
  const requests = serveWorkList({ status: 201, body: createdWorkView });
  renderWorkList();
  const user = await openCreateDialog();

  await user.type(await screen.findByLabelText('Название работы'), 'Петров');
  await user.click(screen.getByText('Тестовый бланк'));
  await user.click(screen.getByRole('button', { name: 'Создать и открыть' }));

  await waitFor(() => {
    expect(navigation.calls).toEqual([
      { method: 'push', href: routes.work('workspace-1', createdId) },
    ]);
  });
  expect(requests.find((request) => request.method === 'POST')).toMatchObject({
    url: worksAddress,
    body: { title: 'Петров', packageVersion: 'test-1' },
  });
});

test('a field error from the response lands on the title, with focus', async () => {
  serveWorkList({
    status: 400,
    body: {
      error: {
        code: 'INVALID_REQUEST',
        requestId: 'r1',
        fields: [{ path: ['title'], code: 'too_long' }],
      },
    },
  });
  renderWorkList();
  const user = await openCreateDialog();

  await user.type(await screen.findByLabelText('Название работы'), 'Петров');
  await user.click(screen.getByRole('button', { name: 'Создать и открыть' }));

  expect(await screen.findByText('Значение слишком длинное.')).toBeTruthy();
  expect(
    screen.getByLabelText('Название работы').getAttribute('aria-invalid'),
  ).toBe('true');
  expectFocused(screen.getByLabelText('Название работы'));
  expect(screen.queryByRole('alert')).toBeNull();
  expect(navigation.calls).toEqual([]);
});

test('a failure without field errors is reported for the form and the creation can be retried', async () => {
  const requests = serveWorkList({
    status: 500,
    body: { error: { code: 'INTERNAL_ERROR', requestId: 'r1' } },
  });
  renderWorkList();
  const user = await openCreateDialog();

  await user.type(await screen.findByLabelText('Название работы'), 'Петров');
  await user.click(screen.getByRole('button', { name: 'Создать и открыть' }));

  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(
    screen.getByText('Не удалось создать работу. Попробуйте снова.'),
  ).toBeTruthy();
  // Общая ошибка не блокирует повтор: кнопка доступна и без правки поля.
  const submit = screen.getByRole('button', { name: 'Создать и открыть' });
  expect(submit.hasAttribute('disabled')).toBe(false);

  // Повтор отправляет запрос ещё раз, а не игнорируется формой.
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({
      method: init?.method ?? 'GET',
      url: typeof input === 'string' ? input : '',
      body: undefined,
    });
    return Promise.resolve(json(201, createdWorkView));
  }) as typeof fetch;
  await user.click(submit);
  await waitFor(() => {
    expect(navigation.calls).toEqual([
      { method: 'push', href: routes.work('workspace-1', createdId) },
    ]);
  });
  expect(requests.filter((request) => request.method === 'POST')).toHaveLength(
    2,
  );
});
