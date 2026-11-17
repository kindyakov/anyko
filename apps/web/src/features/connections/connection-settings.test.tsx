import '../../../test/next-navigation';
import { afterEach, expect, test } from 'bun:test';

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createQueryClient } from '@/lib/api/query-client';

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

function renderSettings() {
  navigation.params = { workspace: 'workspace-1' };
  render(
    <QueryClientProvider client={createQueryClient()}>
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
