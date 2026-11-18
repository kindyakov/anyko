import '../../../../../../../../test/next-navigation';
import { afterEach, expect, test } from 'bun:test';

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { WorkView } from '@anyko/contracts/works';

import { createQueryClient } from '@/lib/api/query-client';
import { sessionKeys } from '@/lib/api/session';

import {
  installEventSource,
  json,
  serveApi,
} from '../../../../../../../../test/api';
import {
  workAddress,
  workId,
  workspaceId,
  workView,
} from '../../../../../../../../test/fixtures';
import { navigation } from '../../../../../../../../test/next-navigation';

import { WorkScreen } from './work-screen';

afterEach(() => {
  navigation.reset();
});

const source = {
  id: '7c14aa4b-0e70-4f27-961a-0542b010c9aa',
  filename: 'source.pdf',
  createdAt: '2026-11-01T10:00:00.000Z',
  status: 'succeeded',
} as const;
const connectionRevoked =
  'Подключение модели отозвано. Владелец области может настроить новое в настройках подключения.';

function renderWork() {
  installEventSource();
  navigation.params = { workspace: workspaceId, id: workId };
  const client = createQueryClient();
  client.setQueryData(sessionKeys.all, {
    user: { id: 'user-1', name: 'Test', email: 'test@example.test' },
    memberships: [
      {
        workspace: { id: workspaceId, name: 'Anyko' },
        rights: ['recognitions.use', 'documents.upload'],
      },
    ],
  });
  render(
    <QueryClientProvider client={client}>
      <WorkScreen workId={workId} />
    </QueryClientProvider>,
  );
}

test('upload confirmation is visible when returning to Files after a pending upload', async () => {
  const response = Promise.withResolvers<undefined>();
  const document = { ...source, status: 'queued' };
  const requests = serveApi(({ method, url }) => {
    if (url.includes('checksum='))
      return json(200, { items: [], nextCursor: null, pendingDeletions: [] });
    if (method !== 'POST') return json(200, workView);
    const reply = json(202, { document });
    reply.json = async () => {
      await response.promise;
      return { document };
    };
    return reply;
  });
  const user = userEvent.setup();
  renderWork();
  await user.upload(await screen.findByLabelText('Файлы клиента'), [
    new File(['%PDF'], source.filename, { type: 'application/pdf' }),
  ]);
  await waitFor(() => {
    expect(requests.at(-1)).toMatchObject({
      method: 'POST',
      url: `${workAddress}/documents`,
    });
  });
  expect(screen.queryByText('Принято 1 файл')).toBeNull();
  await user.click(screen.getByRole('tab', { name: /Извлечение/ }));
  response.resolve(undefined);
  await waitFor(() => {
    expect(
      requests.filter(
        ({ method, url }) => method === 'GET' && url === workAddress,
      ),
    ).toHaveLength(2);
  });
  await user.click(screen.getByRole('tab', { name: /^1\s*Файлы/ }));
  expect(await screen.findByText('Принято 1 файл')).toBeTruthy();
});

test('a matching queued source becomes reusable in the work after its OCR completes', async () => {
  let ready = false;
  const requests = serveApi(({ method, url }) => {
    const digest = new URL(url, 'http://localhost').searchParams.get(
      'checksum',
    );
    if (digest)
      return json(200, {
        items: [
          {
            ...source,
            status: ready ? 'succeeded' : 'queued',
            readyRevision: ready ? 1 : null,
          },
        ],
        checksum: digest,
        nextCursor: null,
        pendingDeletions: [],
      });
    if (method === 'POST' && url === `${workAddress}/attach`)
      return json(200, { status: 'attached' });
    return json(200, workView);
  });
  const user = userEvent.setup();
  renderWork();
  await user.upload(await screen.findByLabelText('Файлы клиента'), [
    new File(['%PDF'], 'same-content.pdf', { type: 'application/pdf' }),
  ]);
  const match = within(
    await screen.findByRole('dialog', { name: 'Такой файл уже есть' }),
  );
  const use = match.getByRole('button', { name: 'Использовать существующий' });
  expect(use.hasAttribute('disabled')).toBe(true);
  ready = true;
  await waitFor(
    () => {
      expect(use.hasAttribute('disabled')).toBe(false);
    },
    { timeout: 4500 },
  );
  await user.click(use);
  await screen.findByText('Принято 1 файл');
  expect(
    requests
      .filter(({ method }) => method === 'POST')
      .map(({ url, body }) => ({ url, body })),
  ).toEqual([
    { url: `${workAddress}/attach`, body: { documentIds: [source.id] } },
  ]);
}, 7000);

test('a work source with an expired OCR result can be recognized again from its row', async () => {
  let document: WorkView['documents'][number] = {
    ...source,
    status: 'failed',
    errorCode: 'OCR_RETRY_REQUIRED',
  };
  const retryAddress = `/api/v1/workspaces/${workspaceId}/recognitions/${source.id}/retry`;
  const requests = serveApi(({ method, url }) => {
    if (method === 'POST' && url === retryAddress) {
      document = { ...source, status: 'queued' };
      return json(202, { document });
    }
    return json(
      200,
      url === workAddress
        ? { ...workView, documents: [document] }
        : { works: [] },
    );
  });
  const user = userEvent.setup();
  renderWork();

  const sources = within(
    await screen.findByRole('region', { name: /Файлы работы/ }),
  );
  const row = within(sources.getByRole('listitem'));
  expect(row.getByText('Документ нужно распознать заново')).toBeTruthy();
  await user.click(row.getByRole('button', { name: 'Повторить' }));

  expect(await row.findByText('Ожидает обработки')).toBeTruthy();
  expect(requests.map(({ method, url }) => [method, url])).toEqual([
    ['GET', workAddress],
    ['POST', retryAddress],
    ['GET', workAddress],
  ]);
});

test('analysis history does not open current OCR artifacts under an older description', async () => {
  const view: WorkView = {
    ...workView,
    facts: { ...workView.facts, version: 1 },
    work: { ...workView.work, inputRevision: 3 },
    documents: [{ ...source, processingRevision: 2 }],
    runs: [
      {
        id: crypto.randomUUID(),
        inputRevision: 2,
        kind: 'analysis',
        status: 'succeeded',
        errorCode: null,
        createdAt: source.createdAt,
        steps: [
          {
            id: crypto.randomUUID(),
            stage: 'vision',
            documentId: source.id,
            status: 'succeeded',
            errorCode: null,
            visuals: [
              {
                path: 'images/old.png',
                description: 'Прежнее изображение',
                imageIndex: 0,
              },
            ],
          },
        ],
      },
    ],
  };
  serveApi(() => json(200, view));
  const user = userEvent.setup();
  renderWork();
  await user.click(await screen.findByRole('tab', { name: /Извлечение/ }));
  await screen.findByText('Источники изменились после этого запуска.');
  expect(
    screen.queryByRole('button', { name: 'Распознанный текст' }),
  ).toBeNull();
  await user.click(screen.getByText(/Что Anyko увидел на изображениях/));
  await screen.findByText('Прежнее изображение');
  expect(
    screen.queryByRole('button', { name: 'Открыть изображение из файла' }),
  ).toBeNull();
});

test.each(['run', 'step'] as const)(
  'the reason for the revoked connection remains visible when recorded on the analysis %s',
  async (location) => {
    const run: WorkView['runs'][number] = {
      id: 'dd1617a1-3bf9-4f68-8b37-bcf42947ad26',
      kind: 'analysis',
      status: 'failed',
      errorCode: location === 'run' ? 'CONNECTION_REVOKED' : null,
      createdAt: source.createdAt,
      steps:
        location === 'step'
          ? [
              {
                id: '62210c15-ee45-43f1-bc02-95be7dd3c023',
                documentId: source.id,
                stage: 'vision',
                status: 'failed',
                errorCode: 'CONNECTION_REVOKED',
                visuals: [],
              },
            ]
          : [],
    };
    serveApi(() =>
      json(200, { ...workView, documents: [source], runs: [run] }),
    );
    const user = userEvent.setup();
    renderWork();

    expect(await screen.findByText(connectionRevoked)).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: /Извлечение/ }));
    const pipeline = within(screen.getByRole('tabpanel'));
    expect(await pipeline.findByText(connectionRevoked)).toBeTruthy();
  },
);

test('an analysis command rejected because the connection was revoked shows guidance', async () => {
  const requests = serveApi(({ method }) =>
    method === 'POST'
      ? json(409, {
          error: { code: 'CONNECTION_REVOKED', requestId: 'analysis' },
        })
      : json(200, { ...workView, documents: [source] }),
  );
  const user = userEvent.setup();
  renderWork();
  const files = within(await screen.findByRole('tabpanel'));
  await user.click(
    await files.findByRole('button', { name: 'Извлечь сведения' }),
  );

  const message = within(await screen.findByRole('alert'));
  expect(message.getByText(connectionRevoked)).toBeTruthy();
  expect(requests.at(-1)).toMatchObject({
    method: 'POST',
    url: `${workAddress}/analyze`,
  });
});
