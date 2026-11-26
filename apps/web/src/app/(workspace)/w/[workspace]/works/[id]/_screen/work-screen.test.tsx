import '../../../../../../../../test/next-navigation';
import { afterEach, expect, test } from 'bun:test';

import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
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

test('the Files step links a source and separates conditional checklist requirements', async () => {
  const document = { ...source, processingRevision: 4 };
  const address = `${workAddress}/checklist-items/passport/documents/${document.id}`;
  let confirmed = false;
  const requests = serveApi(({ method, url }) => {
    if (method === 'PUT' && url === address) {
      confirmed = true;
      return json(200, { status: 'updated' });
    }
    if (url !== workAddress) throw new Error(`Unexpected request ${url}`);
    const view: WorkView = {
      ...workView,
      documents: [document],
      canEditChecklist: true,
      checklist: [
        {
          key: 'passport',
          label: 'Паспорт гражданина',
          documentKind: 'identity',
          applicability: 'usual',
          status: confirmed ? 'confirmed' : 'missing',
          sources: confirmed
            ? [
                {
                  documentId: document.id,
                  status: 'confirmed',
                  quote: null,
                  page: null,
                },
              ]
            : [],
        },
        {
          key: 'marriage',
          label: 'Свидетельство о браке',
          documentKind: 'civil-status',
          applicability: 'conditional',
          status: 'clarify',
          sources: [],
        },
      ],
    };
    return json(200, view);
  });
  renderWork();
  const user = userEvent.setup();
  await user.click(await screen.findByRole('tab', { name: /^1\s*Файлы/ }));
  const openChecklist = async () => {
    await user.click(screen.getByRole('button', { name: 'Чек-лист' }));
    return screen.findByRole('dialog', { name: 'Чек-лист документов' });
  };
  const checklist = within(await openChecklist());
  expect(screen.getAllByRole('list', { name: 'Обычно нужны' })).toHaveLength(1);
  const usual = within(checklist.getByRole('list', { name: 'Обычно нужны' }));
  const conditional = within(
    checklist.getByRole('list', { name: 'По обстоятельствам' }),
  );
  expect(
    usual.getByRole('button', { name: /Паспорт гражданина\s*Не найдено/ }),
  ).toBeTruthy();
  expect(
    conditional.getByRole('button', {
      name: /Свидетельство о браке\s*Уточнить/,
    }),
  ).toBeTruthy();
  await user.click(usual.getByText('Паспорт гражданина'));
  await user.click(
    usual.getByRole('button', {
      name: 'Привязать файл к «Паспорт гражданина»',
    }),
  );
  await user.click(
    await screen.findByRole('menuitem', { name: document.filename }),
  );
  expect(
    await usual.findByRole('button', { name: document.filename }),
  ).toBeTruthy();
  expect(requests.find(({ method }) => method === 'PUT')).toMatchObject({
    url: address,
    body: { decision: 'confirmed', ocrRevision: 4 },
  });
  await user.keyboard('{Escape}');
  await waitFor(() => {
    expect(
      screen.queryByRole('dialog', { name: 'Чек-лист документов' }),
    ).toBeNull();
  });
  await user.click(screen.getByRole('tab', { name: /^3\s*Проверка/ }));
  const reopened = within(await openChecklist());
  await user.click(reopened.getByText('Паспорт гражданина'));
  expect(
    reopened.getByRole('button', { name: document.filename }),
  ).toBeTruthy();
});

test('work history can open a retained analysis run outside the recent work view', async () => {
  const run = {
    id: crypto.randomUUID(),
    status: 'succeeded',
    createdAt: source.createdAt,
  };
  const usage = {
    calls: 2,
    inputTokens: 14,
    outputTokens: 8,
    cachedInputTokens: null,
    reasoningTokens: null,
    unknownInputCalls: 1,
    unknownOutputCalls: 1,
  };
  const requests = serveApi(({ url }) => {
    if (url === workAddress) return json(200, workView);
    if (url.startsWith(`${workAddress}/runs?`))
      return json(200, { items: [run], page: 1, pageSize: 10, total: 1 });
    if (url.startsWith(`${workAddress}/runs/${run.id}/agent-history?`))
      return json(200, {
        items: [
          {
            id: crypto.randomUUID(),
            interactionId: crypto.randomUUID(),
            documentId: null,
            stage: 'reconciliation',
            kind: 'decision',
            status: 'accepted',
            provider: null,
            model: null,
            inputTokens: null,
            outputTokens: null,
            cachedInputTokens: null,
            reasoningTokens: null,
            input: null,
            output: JSON.stringify({ summary: 'Проверены сведения' }),
            fieldChange: null,
            checklistChange: null,
            errorCode: null,
            durationMs: null,
            createdAt: run.createdAt,
          },
        ],
        page: 1,
        pageSize: 5,
        total: 1,
        runUsage: usage,
        workUsage: usage,
        steps: [],
      });
    throw new Error(`Unexpected request ${url}`);
  });
  renderWork();
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Агент' }));
  const dialog = await screen.findByRole('dialog', { name: 'Агент' });
  await user.click(within(dialog).getByRole('tab', { name: 'Журнал' }));
  await user.click(
    await within(dialog).findByRole('button', {
      name: /Автоматический анализ.*Готово/,
    }),
  );
  await user.click(
    await within(dialog).findByRole('button', {
      name: /Сопоставление · Результат сохранён/,
    }),
  );
  expect(within(dialog).getByText(/Проверены сведения/)).toBeTruthy();
  await user.click(within(dialog).getByRole('tab', { name: 'Расход токенов' }));
  for (const name of ['Этот запуск', 'Вся работа']) {
    const usage = within(within(dialog).getByRole('region', { name }));
    expect(usage.getByText('14')).toBeTruthy();
    expect(usage.getByText('8')).toBeTruthy();
  }
  await user.click(within(dialog).getByRole('button', { name: 'К журналу' }));
  expect(
    within(dialog).getByRole('tab', { name: 'Журнал', selected: true }),
  ).toBeTruthy();
  expect(
    requests.some(({ url }) => url.includes(`/runs/${run.id}/agent-history`)),
  ).toBe(true);
});

test('work chat sends a message and reopens with the saved reply and system entry', async () => {
  const runId = crypto.randomUUID();
  const question = 'Какие сведения найдены?';
  const answer = 'В источнике есть имя.';
  let sent = false;
  const requests = serveApi(({ method, url }) => {
    if (url === workAddress) return json(200, workView);
    if (method === 'POST' && url === `${workAddress}/messages`) {
      sent = true;
      return json(202, { runId, status: 'queued' });
    }
    if (url.startsWith(`${workAddress}/messages?`)) {
      const analysis = {
        runId: crypto.randomUUID(),
        kind: 'analysis',
        status: 'succeeded',
        createdAt: source.createdAt,
        errorCode: null,
        userText: null,
        answer: null,
      };
      return json(200, {
        items: sent
          ? [
              { ...analysis, runId, kind: 'chat', userText: question, answer },
              analysis,
            ]
          : [analysis],
        page: 1,
        pageSize: 15,
        total: sent ? 2 : 1,
        canSend: true,
      });
    }
    throw new Error(`Unexpected request ${url}`);
  });
  renderWork();
  const user = userEvent.setup();
  const open = () => user.click(screen.getByRole('button', { name: 'Агент' }));
  await screen.findByRole('button', { name: 'Агент' });
  await open();
  const dialog = within(await screen.findByRole('dialog', { name: 'Агент' }));
  expect(
    await dialog.findByRole('button', {
      name: /Автоматический анализ.*Готово/,
    }),
  ).toBeTruthy();
  await user.type(dialog.getByLabelText('Сообщение агенту'), question);
  await user.click(dialog.getByRole('button', { name: 'Отправить' }));
  expect(await dialog.findByText(answer)).toBeTruthy();
  const posted = requests.find(({ method }) => method === 'POST');
  expect(posted).toMatchObject({
    url: `${workAddress}/messages`,
    body: { userText: question },
  });
  expect(posted?.idempotencyKey).toBeTruthy();
  await user.keyboard('{Escape}');
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: 'Агент' })).toBeNull();
  });
  await open();
  expect(await screen.findByText(question)).toBeTruthy();
  expect(await screen.findByText(answer)).toBeTruthy();
});

test('chat shows a failed or partial write with guidance instead of a success reply', async () => {
  serveApi(({ url }) => {
    if (url === workAddress) return json(200, workView);
    if (!url.startsWith(`${workAddress}/messages?`))
      throw new Error(`Unexpected request ${url}`);
    return json(200, {
      items: ['failed', 'partial'].map((status) => ({
        runId: crypto.randomUUID(),
        kind: 'chat',
        status,
        createdAt: source.createdAt,
        errorCode: 'REVISION_CONFLICT',
        userText: 'Исправьте сведения',
        answer: 'Все сведения обновлены.',
      })),
      page: 1,
      pageSize: 15,
      total: 2,
      canSend: true,
    });
  });
  renderWork();
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Агент' }));
  const chat = within(screen.getByRole('dialog', { name: 'Агент' }));
  const [partial, failed] = await chat.findAllByRole('alert');
  expect(partial?.textContent).toContain('Готово частично');
  expect(partial?.textContent).toContain('проверить сохранённые правки');
  expect(failed?.textContent).toContain(
    'Сведения изменились во время запроса.',
  );
  expect(chat.queryByText('Все сведения обновлены.')).toBeNull();
});

test('upload confirmation is visible when returning to Files after a pending upload', async () => {
  const response = Promise.withResolvers<undefined>();
  const document = { ...source, status: 'queued' };
  const view = { ...workView, documents: [{ ...source, status: 'running' }] };
  const requests = serveApi(({ method, url }) => {
    if (url.includes('checksum='))
      return json(200, {
        items: [],
        page: 1,
        pageSize: 24,
        total: 0,
        pendingDeletions: [],
      });
    if (method !== 'POST') return json(200, view);
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
  const files = within(screen.getByRole('region', { name: /Файлы работы/ }));
  const uploads = within(files.getByRole('list', { name: 'Загрузка файлов' }));
  const attached = within(
    files.getByRole('list', { name: 'Прикреплённые файлы' }),
  );
  expect(uploads.getByText(`${source.filename} — обрабатываем`)).toBeTruthy();
  expect(attached.getByText(source.filename, { exact: true })).toBeTruthy();
  expect(attached.getByText('Распознаётся')).toBeTruthy();
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
        page: 1,
        pageSize: 12,
        total: 1,
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
  const catalogEvents = installEventSource().find(
    ({ url }) => url === `/api/v1/workspaces/${workspaceId}/events`,
  );
  act(() => {
    catalogEvents?.emit('changed', {
      kind: 'recognition',
      documentId: source.id,
    });
  });
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
    await user.click(await screen.findByRole('tab', { name: /Извлечение/ }));
    expect(await screen.findByText(connectionRevoked)).toBeTruthy();
  },
);

test('server availability disables analysis and shows the revoked connection even without a run', async () => {
  const blocked = {
    ...workView,
    documents: [source],
    pendingUploadCount: 1,
    availability: {
      ...workView.availability,
      analyze: { available: false, reason: 'CONNECTION_REVOKED' },
    },
  } satisfies WorkView;
  const requests = serveApi(() => json(200, blocked));
  renderWork();

  expect(await screen.findByText(connectionRevoked)).toBeTruthy();
  const files = within(await screen.findByRole('tabpanel'));
  expect(files.queryByRole('button', { name: 'Извлечь сведения' })).toBeNull();
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
      pendingUploadCount: 0,
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
  await user.click(await screen.findByRole('tab', { name: /Извлечение/ }));
  const extraction = within(await screen.findByRole('tabpanel'));
  await user.click(
    await extraction.findByRole('button', { name: 'Обновить сведения' }),
  );

  const message = within(await screen.findByRole('alert'));
  expect(message.getByText(connectionRevoked)).toBeTruthy();
  expect(requests.find(({ method }) => method === 'POST')).toMatchObject({
    method: 'POST',
    url: `${workAddress}/analyze`,
  });
  await waitFor(() => {
    expect(
      extraction.getByRole('button', { name: 'Обновить сведения' }),
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
          origin: 'inference',
          explanation: 'Имя предположено по инициалам в исходнике.',
          evidence: [
            { documentId: source.id, imagePath: null, quote: 'А. Петрова' },
          ],
        },
        {
          field: 'lastName',
          value: 'Петрова',
          selected: true,
          evidence: [
            {
              documentId: source.id,
              imagePath: null,
              page: 1,
              quote: 'Петрова Мария',
            },
            {
              documentId: source.id,
              imagePath: 'image.png',
              quote: 'М. Петрова',
            },
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
    await screen.findByRole('tab', {
      name: /Проверка\s*требуют внимания:\s*1/,
      selected: true,
    }),
  ).toBeTruthy();
  expect(screen.getByText('Требуют проверки')).toBeTruthy();
  const review = within(
    screen.getByRole('region', { name: 'Найденные сведения' }),
  );
  expect(
    screen.getByRole('button', { name: 'Требуют внимания · 1', pressed: true }),
  ).toBeTruthy();
  expect(review.getByRole('heading', { name: 'Поле Имя' })).toBeTruthy();
  expect(review.queryByRole('heading', { name: 'Поле Фамилия' })).toBeNull();
  expect(review.getByText('Вывод агента')).toBeTruthy();
  expect(review.getByText('Без независимой проверки')).toBeTruthy();
  expect(
    review.getByText('Имя предположено по инициалам в исходнике.'),
  ).toBeTruthy();
  expect(review.getByText('Основания для вывода')).toBeTruthy();
  expect(review.getByText('А. Петрова')).toBeTruthy();
  await user.click(
    review.getByRole('button', { name: 'Подставить это значение' }),
  );
  expect(
    screen.getByRole('button', { name: 'Требуют внимания · 1' }),
  ).toBeTruthy();
  expect(review.getByText('Расхождение')).toBeTruthy();
  expect(review.getByText('Не сохранено')).toBeTruthy();
  expect(review.getByText('Вывод агента')).toBeTruthy();
  expect(
    review.queryByRole('button', { name: 'Подставить это значение' }),
  ).toBeNull();

  await user.click(screen.getByRole('button', { name: 'Сохранить' }));
  expect(
    await screen.findByRole('button', { name: 'Требуют внимания · 0' }),
  ).toBeTruthy();
  expect(review.getByText('Поля для проверки не отмечены')).toBeTruthy();
  expect(
    screen.getByRole('tab', { name: /Проверка/ }).textContent,
  ).not.toContain('требуют внимания');
  expect(requests.find(({ method }) => method === 'PATCH')?.body).toMatchObject(
    {
      revision: 1,
      values: { firstName: 'Анна', lastName: 'Петрова' },
    },
  );
  await user.click(review.getByRole('button', { name: 'Посмотреть все поля' }));
  const firstName = within(review.getByRole('article', { name: 'Поле Имя' }));
  expect(firstName.getByText('Вывод агента')).toBeTruthy();
  expect(firstName.getByText('Без независимой проверки')).toBeTruthy();
  const surname = within(review.getByRole('article', { name: 'Поле Фамилия' }));
  expect(surname.getByText('Из документа')).toBeTruthy();
  expect(surname.getByText('Петрова', { exact: true })).toBeTruthy();
  expect(
    surname.getByRole('button', {
      name: `Открыть стр. 1 — ${source.filename}`,
    }),
  ).toBeTruthy();
  expect(
    surname.queryByRole('button', {
      name: `Открыть файл — ${source.filename}`,
    }),
  ).toBeNull();
  await user.click(
    surname.getByRole('button', { name: 'Ещё из этого файла · 1' }),
  );
  expect(surname.getByText('М. Петрова')).toBeTruthy();
  expect(
    surname.getByRole('button', { name: `Открыть файл — ${source.filename}` }),
  ).toBeTruthy();
});

test('merged values show their included findings and keep them out of attention', async () => {
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
      discrepancyFields: ['firstName'],
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
  expect(
    review.queryByRole('heading', { name: 'Поле Обязательства' }),
  ).toBeNull();
  expect(review.getByRole('heading', { name: 'Поле Имя' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Все поля · 2' }));
  expect(review.getAllByText('Совпадает полностью или частично')).toHaveLength(
    2,
  );
  expect(
    review.getAllByRole('button', { name: 'Подставить это значение' }),
  ).toHaveLength(1);
});
