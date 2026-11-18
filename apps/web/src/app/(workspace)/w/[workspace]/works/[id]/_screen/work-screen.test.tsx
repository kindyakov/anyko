import '../../../../../../../../test/next-navigation';
import { afterEach, expect, test } from 'bun:test';

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { WorkView } from '@anyko/contracts/works';

import { createQueryClient } from '@/lib/api/query-client';

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
  render(
    <QueryClientProvider client={createQueryClient()}>
      <WorkScreen workId={workId} />
    </QueryClientProvider>,
  );
}

test('upload confirmation is visible when returning to Files after a pending upload', async () => {
  const response = Promise.withResolvers<undefined>();
  const document = { ...source, status: 'queued' };
  const requests = serveApi(({ method }) => {
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
  expect(requests.at(-1)).toMatchObject({
    method: 'POST',
    url: `${workAddress}/documents`,
  });
  expect(screen.queryByText('Принято 1 файл')).toBeNull();
  await user.click(screen.getByRole('tab', { name: /Извлечение/ }));
  response.resolve(undefined);
  await waitFor(() => {
    expect(requests.filter(({ method }) => method === 'GET')).toHaveLength(2);
  });
  await user.click(screen.getByRole('tab', { name: /^1\s*Файлы/ }));
  expect(await screen.findByText('Принято 1 файл')).toBeTruthy();
});

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

test('server availability disables analysis and shows the revoked connection even without a run', async () => {
  const blocked = {
    ...workView,
    documents: [source],
    availability: {
      ...workView.availability,
      analyze: { available: false, reason: 'CONNECTION_REVOKED' },
    },
  } satisfies WorkView;
  const requests = serveApi(() => json(200, blocked));
  const user = userEvent.setup();
  renderWork();

  expect(await screen.findByText(connectionRevoked)).toBeTruthy();
  const files = within(await screen.findByRole('tabpanel'));
  const analyze = files.getByRole('button', { name: 'Извлечь сведения' });
  expect(analyze).toHaveProperty('disabled', true);
  await user.click(analyze);
  expect(requests.some(({ method }) => method === 'POST')).toBe(false);
  expect(
    (await files.findByLabelText<HTMLInputElement>('Файлы клиента')).disabled,
  ).toBe(false);
});

test('an analysis command rejected because the connection was revoked shows guidance', async () => {
  let revoked = false;
  const requests = serveApi(({ method }) => {
    if (method === 'POST') {
      revoked = true;
      return json(409, {
        error: { code: 'CONNECTION_REVOKED', requestId: 'analysis' },
      });
    }
    return json(200, {
      ...workView,
      documents: [source],
      availability: {
        ...workView.availability,
        analyze: revoked
          ? { available: false, reason: 'CONNECTION_REVOKED' }
          : { available: true },
      },
    });
  });
  const user = userEvent.setup();
  renderWork();
  const files = within(await screen.findByRole('tabpanel'));
  await user.click(
    await files.findByRole('button', { name: 'Извлечь сведения' }),
  );

  const message = within(await screen.findByRole('alert'));
  expect(message.getByText(connectionRevoked)).toBeTruthy();
  expect(requests.find(({ method }) => method === 'POST')).toMatchObject({
    method: 'POST',
    url: `${workAddress}/analyze`,
  });
  await waitFor(() => {
    expect(
      files.getByRole('button', { name: 'Извлечь сведения' }),
    ).toHaveProperty('disabled', true);
  });
});

test('review shows the saved discrepancy list through an unsaved edit and refreshes it after saving', async () => {
  const view: WorkView = {
    ...workView,
    package: {
      ...workView.package,
      fields: [
        {
          key: 'firstName',
          label: 'Имя',
          multiline: false,
          kind: 'text',
          limits: {},
          columns: [],
        },
        {
          key: 'lastName',
          label: 'Фамилия',
          multiline: false,
          kind: 'text',
          limits: {},
          columns: [],
        },
      ],
    },
    documents: [source],
    runs: [
      {
        id: 'dd1617a1-3bf9-4f68-8b37-bcf42947ad26',
        kind: 'analysis',
        status: 'succeeded',
        errorCode: null,
        createdAt: source.createdAt,
        steps: [],
      },
    ],
    session: {
      id: '62210c15-ee45-43f1-bc02-95be7dd3c023',
      revision: 1,
      updatedAt: source.createdAt,
      context: {
        version: 1,
        workRevision: 1,
        inputRevision: 1,
        settingsRevision: 1,
        promptVersion: 'work-context-v1',
        summary: 'Сводка по документам',
        documents: [],
        missingFields: [],
        conflictFields: ['lastName'],
      },
    },
    facts: {
      ...workView.facts,
      values: { firstName: 'Мария', lastName: 'Петрова' },
      manual: ['firstName'],
      candidates: [
        {
          field: 'firstName',
          value: 'Анна',
          selected: false,
          evidence: [{ documentId: source.id, imagePath: null, quote: 'Анна' }],
        },
        {
          field: 'lastName',
          value: 'Петрова',
          selected: true,
          evidence: [
            { documentId: source.id, imagePath: null, quote: 'Петрова' },
          ],
        },
      ],
      discrepancyFields: ['firstName'],
    },
  };
  let saved = view;
  const requests = serveApi(({ method }) => {
    if (method === 'PATCH')
      saved = {
        ...view,
        work: { ...view.work, revision: 2 },
        facts: {
          ...view.facts,
          values: { ...view.facts.values, firstName: 'Анна' },
          candidates: view.facts.candidates.map((candidate) => ({
            ...candidate,
            selected: true,
          })),
          discrepancyFields: [],
        },
      };
    return json(200, saved);
  });
  const user = userEvent.setup();
  renderWork();

  expect(
    await screen.findByText('Проверьте сведения и разрешите расхождения'),
  ).toBeTruthy();
  expect(screen.getByText(/^Найдено полей: 2, расхождений: 1\./)).toBeTruthy();
  expect(screen.getByText('Требуют проверки')).toBeTruthy();
  const review = within(
    screen.getByRole('region', { name: 'Найденные сведения' }),
  );
  await user.click(review.getByRole('button', { name: 'Расхождения · 1' }));
  expect(review.getByRole('heading', { name: 'Имя' })).toBeTruthy();
  expect(review.queryByRole('heading', { name: 'Фамилия' })).toBeNull();
  await user.click(review.getByRole('button', { name: 'Применить' }));
  expect(review.getByRole('button', { name: 'Расхождения · 1' })).toBeTruthy();
  expect(review.getByText('Расхождение')).toBeTruthy();
  expect(review.getByText('Выбрано')).toBeTruthy();
  expect(review.queryByRole('button', { name: 'Применить' })).toBeNull();

  await user.click(screen.getByRole('button', { name: 'Сохранить' }));
  expect(
    await review.findByRole('button', { name: 'Расхождения · 0' }),
  ).toBeTruthy();
  expect(
    review.getByText('В сохранённых сведениях нет расхождений.'),
  ).toBeTruthy();
  expect(screen.getByText('Проверьте найденные сведения')).toBeTruthy();
  expect(requests.find(({ method }) => method === 'PATCH')?.body).toMatchObject(
    {
      revision: 1,
      values: { firstName: 'Анна', lastName: 'Петрова' },
    },
  );
});

test('saved candidate marks keep a merged field out of pending review and hide its apply actions', async () => {
  const first = { name: 'Банк А', basis: 'Договор А' };
  const second = { name: 'Банк Б', basis: 'Договор Б' };
  const view: WorkView = {
    ...workView,
    documents: [source],
    runs: [
      {
        id: 'dd1617a1-3bf9-4f68-8b37-bcf42947ad26',
        kind: 'analysis',
        status: 'succeeded',
        errorCode: null,
        createdAt: source.createdAt,
        steps: [],
      },
    ],
    package: {
      ...workView.package,
      fields: [
        {
          key: 'debts',
          label: 'Обязательства',
          kind: 'rows',
          columns: [],
          limits: {},
          multiline: false,
        },
        {
          key: 'firstName',
          label: 'Имя',
          kind: 'text',
          columns: [],
          limits: {},
          multiline: false,
        },
      ],
    },
    facts: {
      ...workView.facts,
      values: { debts: [first, second], firstName: 'Мария' },
      candidates: [
        {
          field: 'debts',
          value: [first],
          selected: true,
          evidence: [
            { documentId: source.id, imagePath: null, quote: first.name },
          ],
        },
        {
          field: 'debts',
          value: [second],
          selected: true,
          evidence: [
            { documentId: source.id, imagePath: null, quote: second.name },
          ],
        },
        {
          field: 'firstName',
          value: 'Анна',
          selected: false,
          evidence: [{ documentId: source.id, imagePath: null, quote: 'Анна' }],
        },
      ],
    },
  };
  serveApi(() => json(200, view));
  const user = userEvent.setup();
  renderWork();

  const review = within(
    await screen.findByRole('region', { name: 'Найденные сведения' }),
  );
  expect(review.getAllByText('Выбрано')).toHaveLength(2);
  expect(review.getAllByRole('button', { name: 'Применить' })).toHaveLength(1);
  await user.click(review.getByRole('button', { name: 'Не применены · 1' }));
  expect(review.queryByRole('heading', { name: 'Обязательства' })).toBeNull();
  expect(review.getByRole('heading', { name: 'Имя' })).toBeTruthy();
  expect(review.queryByText('Выбрано')).toBeNull();
});
