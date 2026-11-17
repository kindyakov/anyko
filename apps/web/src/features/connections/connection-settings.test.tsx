import '../../../test/next-navigation';
import { afterEach, expect, test } from 'bun:test';

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Right, Session } from '@anyko/contracts/session';

import { createQueryClient } from '@/lib/api/query-client';
import { sessionKeys } from '@/lib/api/session';

import { expectFocused } from '../../../test/focus';
import { navigation } from '../../../test/next-navigation';

import { ConnectionSettings } from './connection-settings';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  navigation.reset();
});

type Settings = {
  settings: {
    revision: number;
    baseURL: string;
    visionModel: string;
    extractionModel: string;
    configured: boolean;
  } | null;
  canManage: boolean;
};

const configured: Settings = {
  settings: {
    revision: 3,
    baseURL: 'https://models.example.test/v1',
    visionModel: 'vision-model',
    extractionModel: 'extraction-model',
    configured: true,
  },
  canManage: true,
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Сеть подменяется на уровне fetch. GET отдаёт текущие настройки сервера, успешный POST
// заменяет их; так проверяется, что форма показывает версию после сохранения.
function serveSettings(initial: Settings, saveStatus = 200) {
  let current = initial;
  const requests: { method: string; body: unknown }[] = [];
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body: unknown =
      typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    requests.push({ method, body });
    if (method === 'GET') return Promise.resolve(json(200, current));
    if (saveStatus !== 200) return Promise.resolve(json(saveStatus, {}));
    const saved = body as {
      baseURL: string;
      visionModel: string;
      extractionModel: string;
    };
    current = {
      settings: {
        revision: (current.settings?.revision ?? 0) + 1,
        baseURL: saved.baseURL,
        visionModel: saved.visionModel,
        extractionModel: saved.extractionModel,
        configured: true,
      },
      canManage: true,
    };
    return Promise.resolve(json(200, { status: 'saved' }));
  }) as typeof fetch;
  return requests;
}

// Сессия в кэше задаёт права текущей области; по умолчанию у пользователя есть право изменения.
function sessionWith(rights: Right[]): Session {
  return {
    user: { id: 'user-1', name: 'Test', email: 'user@example.test' },
    memberships: [
      { workspace: { id: 'workspace-1', name: 'Workspace' }, rights },
    ],
  };
}

function renderSettings(
  rights: Right[] = ['connections.read', 'connections.manage'],
) {
  navigation.params = { workspace: 'workspace-1' };
  const client = createQueryClient();
  client.setQueryData(sessionKeys.all, sessionWith(rights));
  render(
    <QueryClientProvider client={client}>
      <ConnectionSettings />
    </QueryClientProvider>,
  );
}

test('shows the connection that is already configured in the workspace', async () => {
  serveSettings(configured);
  renderSettings();

  expect(await screen.findByText('Подключено')).toBeTruthy();
  expect(screen.getByLabelText('Адрес API').getAttribute('value')).toBe(
    'https://models.example.test/v1',
  );
  expect(
    screen.getByLabelText('Модель для изображений').getAttribute('value'),
  ).toBe('vision-model');
  expect(
    screen
      .getByLabelText('Модель для извлечения сведений')
      .getAttribute('value'),
  ).toBe('extraction-model');
});

test('saves the changed address and shows the stored version afterwards', async () => {
  const requests = serveSettings(configured);
  renderSettings();
  const user = userEvent.setup();

  const address = await screen.findByLabelText('Адрес API');
  await user.clear(address);
  await user.type(address, 'https://new.example.test/v1');
  await user.click(
    screen.getByRole('button', { name: 'Сохранить подключение' }),
  );

  expect(
    await screen.findByText(
      'Настройки сохранены. Новые запуски используют эту версию.',
    ),
  ).toBeTruthy();
  // Пустое поле ключа не отправляется: сервер сохраняет текущий ключ.
  expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
    baseURL: 'https://new.example.test/v1',
    visionModel: 'vision-model',
    extractionModel: 'extraction-model',
  });
  await waitFor(() => {
    expect(screen.getByLabelText('Адрес API').getAttribute('value')).toBe(
      'https://new.example.test/v1',
    );
  });
});

test('reports a rejected save as an alert and does not claim success', async () => {
  serveSettings(configured, 400);
  renderSettings();
  const user = userEvent.setup();

  await user.click(
    await screen.findByRole('button', { name: 'Сохранить подключение' }),
  );

  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(
    screen.getByText(
      'Не удалось сохранить настройки. Проверьте адрес, модели и ключ.',
    ),
  ).toBeTruthy();
  expect(
    screen.queryByText(
      'Настройки сохранены. Новые запуски используют эту версию.',
    ),
  ).toBeNull();
});

const saveFailure =
  'Не удалось сохранить настройки. Проверьте адрес, модели и ключ.';

// Ответ на сохранение задаёт тест; чтение отдаёт сохранённые настройки.
function serveSaveAnswer(status: number, body: unknown) {
  const requests: { method: string; body: unknown }[] = [];
  globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const payload: unknown =
      typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    requests.push({ method, body: payload });
    if (method === 'GET') return Promise.resolve(json(200, configured));
    return Promise.resolve(json(status, body));
  }) as typeof fetch;
  return requests;
}

// Возвращает true, если страница просит подтверждение при уходе (beforeunload отменён).
function leavePageWarns(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

test('an empty address is refused on the client: nothing is sent and the address is focused', async () => {
  const requests = serveSettings(configured);
  renderSettings();
  const user = userEvent.setup();

  const address = await screen.findByLabelText('Адрес API');
  await user.clear(address);
  await user.click(
    screen.getByRole('button', { name: 'Сохранить подключение' }),
  );

  expect(await screen.findByText('Введите адрес API')).toBeTruthy();
  expect(address.getAttribute('aria-invalid')).toBe('true');
  expectFocused(address);
  expect(requests.some((request) => request.method === 'POST')).toBe(false);
});

test('a field error from the server lands on its field, which takes focus', async () => {
  serveSaveAnswer(400, {
    error: {
      code: 'INVALID_REQUEST',
      requestId: 'r1',
      fields: [{ path: 'visionModel', code: 'UNKNOWN_MODEL' }],
    },
  });
  renderSettings();
  const user = userEvent.setup();

  await user.click(
    await screen.findByRole('button', { name: 'Сохранить подключение' }),
  );

  expect(await screen.findByText(saveFailure)).toBeTruthy();
  const vision = screen.getByLabelText('Модель для изображений');
  expect(vision.getAttribute('aria-invalid')).toBe('true');
  expectFocused(vision);
  expect(screen.queryByRole('alert')).toBeNull();
});

test('a field the form does not have is reported as the form alert', async () => {
  serveSaveAnswer(400, {
    error: {
      code: 'INVALID_REQUEST',
      requestId: 'r1',
      fields: [{ path: 'ghostField', code: 'UNKNOWN' }],
    },
  });
  renderSettings();
  const user = userEvent.setup();

  await user.click(
    await screen.findByRole('button', { name: 'Сохранить подключение' }),
  );

  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByText(saveFailure)).toBeTruthy();
});

test('unsaved edits make leaving the page warn; saving removes the warning', async () => {
  serveSettings(configured);
  renderSettings();
  const user = userEvent.setup();

  const address = await screen.findByLabelText('Адрес API');
  expect(leavePageWarns()).toBe(false);

  await user.type(address, '/v2');
  expect(leavePageWarns()).toBe(true);

  await user.click(
    screen.getByRole('button', { name: 'Сохранить подключение' }),
  );
  expect(
    await screen.findByText(
      'Настройки сохранены. Новые запуски используют эту версию.',
    ),
  ).toBeTruthy();
  await waitFor(() => {
    expect(leavePageWarns()).toBe(false);
  });
});

// Право только для отображения: без него значения видны, но сохранить или ввести ключ нельзя.
// Сервер всё равно проверит право при сохранении; здесь проверяется, что интерфейс его не предлагает.
test('without the manage right the connection is read-only: no save button, no key field, no request', async () => {
  const requests = serveSettings(configured);
  renderSettings(['connections.read']);

  const address = await screen.findByLabelText('Адрес API');
  expect(address.getAttribute('value')).toBe('https://models.example.test/v1');
  expect(address.hasAttribute('readonly')).toBe(true);
  expect(
    screen.getByLabelText('Модель для изображений').hasAttribute('readonly'),
  ).toBe(true);
  expect(
    screen.queryByRole('button', { name: 'Сохранить подключение' }),
  ).toBeNull();
  expect(screen.queryByLabelText('API-ключ')).toBeNull();
  expect(
    screen.getByText('Изменять подключение может владелец рабочей области.'),
  ).toBeTruthy();
  expect(requests.some((request) => request.method === 'POST')).toBe(false);
});

test('reverting an edit to the saved value removes the leave warning', async () => {
  serveSettings(configured);
  renderSettings();
  const user = userEvent.setup();

  const address = await screen.findByLabelText('Адрес API');
  await user.type(address, '/v2');
  expect(leavePageWarns()).toBe(true);

  await user.type(address, '{Backspace}{Backspace}{Backspace}');
  expect(leavePageWarns()).toBe(false);
});
