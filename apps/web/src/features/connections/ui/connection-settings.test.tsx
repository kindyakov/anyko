import '../../../../test/next-navigation';
import { afterEach, expect, test } from 'bun:test';

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Right, Session } from '@anyko/contracts/session';

import { createQueryClient } from '@/lib/api/query-client';
import { sessionKeys } from '@/lib/api/session';

import { networkError, serveApi } from '../../../../test/api';
import { expectFocused } from '../../../../test/focus';
import { navigation } from '../../../../test/next-navigation';

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
    visionDisableReasoning?: boolean;
    extractionEnableReasoning?: boolean;
    configured: boolean;
  } | null;
  canManage: boolean;
};

const configured = {
  settings: {
    revision: 3,
    baseURL: 'https://models.example.test/v1',
    visionModel: 'vision-model',
    visionDisableReasoning: false,
    extractionModel: 'extraction-model',
    extractionEnableReasoning: true,
    configured: true,
  },
  canManage: true,
} satisfies Settings;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Сеть подменяется на уровне fetch. GET отдаёт текущие настройки сервера, успешный PATCH
// заменяет их; так проверяется, что форма показывает версию после сохранения.
const settingsAddress = '/api/v1/workspaces/workspace-1/connections/llm';

function serveSettings(initial: Settings, saveStatus = 200) {
  let current = initial;
  const requests: { method: string; url: string; body: unknown }[] = [];
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const body: unknown =
      typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    requests.push({ method, url, body });
    if (method === 'GET') return Promise.resolve(json(200, current));
    if (saveStatus !== 200) return Promise.resolve(json(saveStatus, {}));
    const saved = body as {
      baseURL: string;
      visionModel: string;
      extractionModel: string;
      visionDisableReasoning?: boolean;
      extractionEnableReasoning?: boolean;
    };
    current = {
      settings: {
        revision: (current.settings?.revision ?? 0) + 1,
        baseURL: saved.baseURL,
        visionModel: saved.visionModel,
        extractionModel: saved.extractionModel,
        ...(saved.visionDisableReasoning === undefined
          ? {}
          : { visionDisableReasoning: saved.visionDisableReasoning }),
        ...(saved.extractionEnableReasoning === undefined
          ? {}
          : { extractionEnableReasoning: saved.extractionEnableReasoning }),
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
  expect(requests.find((request) => request.method === 'PATCH')).toMatchObject({
    url: settingsAddress,
    body: {
      baseURL: 'https://new.example.test/v1',
      visionModel: 'vision-model',
      extractionModel: 'extraction-model',
    },
  });
  expect(requests.filter((request) => request.method === 'GET')[0]?.url).toBe(
    settingsAddress,
  );
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

test('saves reasoning choices independently for the two models', async () => {
  const requests = serveSettings(configured);
  renderSettings();
  const user = userEvent.setup();
  const vision = await screen.findByRole('switch', {
    name: 'Отключать рассуждения при распознавании изображений',
  });
  const extraction = screen.getByRole('switch', {
    name: 'Включать высокий уровень рассуждений при извлечении сведений',
  });
  expect(vision.getAttribute('aria-checked')).toBe('false');
  expect(extraction.getAttribute('aria-checked')).toBe('true');
  await user.click(vision);
  expect(extraction.getAttribute('aria-checked')).toBe('true');
  await user.click(extraction);
  await user.click(
    screen.getByRole('button', { name: 'Сохранить подключение' }),
  );
  await waitFor(() => {
    expect(
      requests.find(({ method }) => method === 'PATCH')?.body,
    ).toMatchObject({
      visionDisableReasoning: true,
      extractionEnableReasoning: false,
    });
  });
});

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
  expect(requests.some((request) => request.method === 'PATCH')).toBe(false);
});

test('a field error from the server lands on its field, which takes focus', async () => {
  serveSaveAnswer(400, {
    error: {
      code: 'INVALID_REQUEST',
      requestId: 'r1',
      fields: [{ path: ['visionModel'], code: 'invalid_value' }],
    },
  });
  renderSettings();
  const user = userEvent.setup();

  await user.click(
    await screen.findByRole('button', { name: 'Сохранить подключение' }),
  );

  expect(await screen.findByText('Проверьте значение поля.')).toBeTruthy();
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
      fields: [{ path: ['ghostField'], code: 'invalid_value' }],
    },
  });
  renderSettings();
  const user = userEvent.setup();

  await user.click(
    await screen.findByRole('button', { name: 'Сохранить подключение' }),
  );

  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByText('Проверьте значение поля.')).toBeTruthy();
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
test('without the manage right the connection is read-only: no save or revoke button', async () => {
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
  expect(
    screen.queryByRole('button', { name: 'Отозвать подключение' }),
  ).toBeNull();
  expect(screen.queryByLabelText('API-ключ')).toBeNull();
  expect(
    screen.getByText('Изменять подключение может владелец рабочей области.'),
  ).toBeTruthy();
  expect(requests.some((request) => request.method === 'PATCH')).toBe(false);
});

test('reverting an edit to the saved value removes the leave warning', async () => {
  serveSettings({
    ...configured,
    settings: {
      ...configured.settings,
      visionDisableReasoning: true,
      extractionEnableReasoning: false,
    },
  });
  renderSettings();
  const user = userEvent.setup();

  const address = await screen.findByLabelText('Адрес API');
  await user.type(address, '/v2');
  expect(leavePageWarns()).toBe(true);

  await user.type(address, '{Backspace}{Backspace}{Backspace}');
  expect(leavePageWarns()).toBe(false);
});

test('revocation requires confirmation and refreshes the form from the server', async () => {
  let settings: Settings = configured;
  const requests = serveApi(({ method }) => {
    if (method === 'DELETE') {
      settings = { ...settings, settings: null };
      return json(200, { status: 'revoked' });
    }
    return json(200, settings);
  });
  renderSettings();
  const user = userEvent.setup();

  const revoke = await screen.findByRole('button', {
    name: 'Отозвать подключение',
  });
  await user.click(revoke);
  const dialog = within(
    await screen.findByRole('alertdialog', {
      name: 'Отозвать подключение модели?',
    }),
  );
  await user.click(dialog.getByRole('button', { name: 'Отмена' }));
  expect(requests.map(({ method }) => method)).toEqual(['GET']);
  expect(screen.getByText('Подключено')).toBeTruthy();

  await user.click(revoke);
  const confirmation = within(await screen.findByRole('alertdialog'));
  await user.click(
    confirmation.getByRole('button', { name: 'Отозвать подключение' }),
  );
  expect(await screen.findByText('Не настроено')).toBeTruthy();
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'Отозвать подключение' }),
  ).toBeNull();
  expect(screen.getByLabelText('API-ключ').hasAttribute('required')).toBe(true);
  expect(requests.map(({ method, url }) => [method, url])).toEqual([
    ['GET', settingsAddress],
    ['DELETE', settingsAddress],
    ['GET', settingsAddress],
  ]);
});

test.each([
  ['forbidden', 'Недостаточно прав для этого действия.'],
  ['network', 'Не удалось получить ответ сервера. Повторите попытку позже.'],
] as const)(
  'a %s error from revoke is visible and leaves the saved connection in place',
  async (failure, message) => {
    serveApi(({ method }) => {
      if (method === 'GET') return json(200, configured);
      return failure === 'network'
        ? networkError
        : json(403, { error: { code: 'FORBIDDEN', requestId: 'revoke' } });
    });
    renderSettings();
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole('button', { name: 'Отозвать подключение' }),
    );
    const dialog = within(await screen.findByRole('alertdialog'));
    await user.click(
      dialog.getByRole('button', { name: 'Отозвать подключение' }),
    );

    expect(
      within(await screen.findByRole('alert')).getByText(message),
    ).toBeTruthy();
    expect(screen.getByText('Подключено')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Отозвать подключение' }),
    ).toBeTruthy();
  },
);
