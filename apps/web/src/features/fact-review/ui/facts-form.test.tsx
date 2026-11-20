import { availableWorkCommands } from '../../../../test/fixtures';
import '../../../../test/next-navigation';
import { afterEach, expect, test } from 'bun:test';

import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  documentPackageSchema,
  type FieldValues,
} from '@anyko/contracts/catalog';
import type { WorkView } from '@anyko/contracts/works';

import { useWorkView } from '@/features/works';
import { createQueryClient } from '@/lib/api/query-client';
import { UnsavedNavigation } from '@/lib/unsaved-navigation';

import {
  type Exchange,
  installEventSource,
  json,
  serveApi,
} from '../../../../test/api';
import {
  workAddress,
  workId,
  workspaceId,
  workView,
} from '../../../../test/fixtures';
import { navigation } from '../../../../test/next-navigation';

import { useFactsForm } from './facts-form';
import { emptyFieldValues, fieldDefinitions } from './test-fields';
import { UnsavedFactsBar } from './unsaved-facts-bar';
import { WorkReview } from './work-review';

afterEach(() => {
  navigation.reset();
});

const paragraph = (text: string) => ({
  text,
  align: 'left',
  bold: false,
  fontSize: 12,
  indent: 0,
  after: 0,
});

// Пакет с двумя полями, которые редактируются прямо в документе (как в экране проверки).
const pack = documentPackageSchema.parse({
  id: 'package-1',
  version: 'v1',
  title: 'Пакет',
  technical: false,
  fields: fieldDefinitions.filter((field) =>
    ['personName', 'observations'].includes(field.key),
  ),
  documents: [
    {
      id: 'template-1',
      version: 'v1',
      title: 'Заявление',
      filename: 'application.docx',
      checksum: 'a'.repeat(64),
      blocks: [
        {
          kind: 'table',
          widths: [1, 1],
          rows: [
            {
              repeat: null,
              cells: [
                {
                  span: 1,
                  merge: 'none',
                  paragraphs: [paragraph('Должник: {personName}')],
                },
                {
                  span: 1,
                  merge: 'none',
                  paragraphs: [paragraph('Примечание: {observations}')],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});

type WorkJson = ReturnType<typeof viewWith>;

// Вид работы, который отдаёт сервер: значения сведений и ревизия задаются тестом.
function viewWith(
  values: Partial<FieldValues>,
  options: { revision?: number; cleanupPending?: boolean } = {},
) {
  return {
    ...workView,
    work: { ...workView.work, revision: options.revision ?? 1 },
    package: pack,
    facts: {
      version: 1 as const,
      values: { ...emptyFieldValues(), ...values },
      manual: [],
      confirmed: [],
      discrepancyFields: [],
      candidates: [],
    },
    cleanupPending: options.cleanupPending ?? false,
    availability: availableWorkCommands,
  };
}

// Сервер хранит текущий вид работы; тест меняет его, как это сделал бы другой пользователь.
// Сохранение по умолчанию принимает ревизию и увеличивает её; `nextSave` подменяет ответ.
function serveWork(initial: WorkJson) {
  // Поток событий подменяется до отрисовки: тесты читают его источники из общего списка.
  const sources = installEventSource();
  const server: {
    current: WorkJson;
    nextSave?: (exchange: Exchange) => Response;
  } = { current: initial };
  const exchanges = serveApi((exchange) => {
    if (exchange.method === 'GET') return json(200, server.current);
    if (server.nextSave) return server.nextSave(exchange);
    const body = exchange.body as { revision: number; values: FieldValues };
    if (body.revision !== server.current.work.revision)
      return json(409, {
        error: { code: 'REVISION_CONFLICT', requestId: 'r' },
      });
    server.current = viewWith(body.values, {
      revision: server.current.work.revision + 1,
    });
    return json(200, server.current);
  });
  return {
    exchanges,
    change(next: WorkJson) {
      server.current = next;
    },
    answerNextSaveWith(handler: (exchange: Exchange) => Response) {
      server.nextSave = handler;
    },
    // Событие потока сообщает, что работа изменилась: вид перечитывается из API.
    announceChange() {
      const [source] = sources;
      act(() => {
        source?.emit('changed');
      });
    },
  };
}

// Экран проверки в тех же частях, что и экран работы: вид из кэша, форма и полоса feature.
function FactsScreen() {
  const { view, loadError } = useWorkView({ workspaceId, workId });
  if (!view) return <p role="status">{loadError || 'Открываем работу'}</p>;
  return <FactsEditor view={view} />;
}

function FactsEditor({ view }: { view: WorkView }) {
  const facts = useFactsForm(view);
  const busy = facts.saving || view.cleanupPending;
  return (
    <>
      <span data-testid="server-package-title">{view.package.title}</span>
      <WorkReview
        view={view}
        facts={facts}
        busy={busy}
        onOpen={() => undefined}
      />
      <UnsavedFactsBar facts={facts} busy={busy} />
      <UnsavedNavigation dirty={facts.hasEdits} />
      <a href="/w/workspace-1/works">Все работы</a>
      <a href="/w/workspace-1/works" target="_blank" rel="noreferrer">
        В новой вкладке
      </a>
    </>
  );
}

test('court alternatives expose the official source and replace the court and address together', async () => {
  const courtName = 'Арбитражный суд Московской области';
  const courtAddress = '107053, Москва, пр-кт Академика Сахарова, 18';
  const alternative = '107053, Москва, Садовая-Спасская, 18';
  const contactUrl = 'https://asmo.arbitr.ru/about/mode';
  const currentName = 'Арбитражный суд города Москвы';
  const currentAddress = '115191, Москва, ул. Большая Тульская, 17';
  const initial = viewWith({
    courtName: currentName,
    courtAddress: currentAddress,
  });
  const courtPackage = documentPackageSchema.parse({
    ...pack,
    fields: [
      {
        key: 'courtName',
        label: 'Арбитражный суд',
        kind: 'text',
        multiline: false,
        limits: {},
        columns: [],
      },
      {
        key: 'courtAddress',
        label: 'Адрес суда',
        kind: 'text',
        multiline: false,
        limits: {},
        columns: [],
      },
    ],
    documents: [
      {
        ...pack.documents[0],
        blocks: [
          {
            kind: 'paragraph',
            paragraph: paragraph('{courtName}: {courtAddress}'),
          },
        ],
      },
    ],
  });
  const candidates: WorkView['facts']['candidates'] = [
    courtAddress,
    alternative,
  ].map((value) => ({
    field: 'courtAddress',
    origin: 'inference',
    selected: false,
    value,
    explanation: 'Контактная страница суда указывает два адреса',
    evidence: [
      {
        documentId: crypto.randomUUID(),
        imagePath: null,
        quote: 'Московская область',
      },
    ],
    courtSources: {
      catalogueUrl: 'https://arbitr.ru/',
      contactUrl,
      checkedAt: '2026-11-20T00:00:00.000Z',
      courtName,
    },
  }));
  candidates.push({
    field: 'courtName',
    origin: 'inference',
    selected: false,
    value: currentName,
    evidence: [
      { documentId: crypto.randomUUID(), imagePath: null, quote: 'Москва' },
    ],
    courtSources: {
      catalogueUrl: 'https://arbitr.ru/',
      checkedAt: '2026-11-20T00:00:00.000Z',
      courtName: currentName,
      contactUrl: 'https://msk.arbitr.ru/about/mode',
    },
  });
  installEventSource();
  serveApi(() =>
    json(200, {
      ...initial,
      package: courtPackage,
      facts: {
        ...initial.facts,
        candidates,
        manual: ['courtAddress'],
        discrepancyFields: ['courtAddress'],
      },
    }),
  );
  renderFacts();

  await userEvent
    .setup()
    .click(await screen.findByRole('button', { name: /Все поля/ }));
  const nameCard = await screen.findByRole('article', {
    name: /Арбитражный суд/,
  });
  expect(
    within(nameCard).queryAllByRole('button', { name: 'Подставить суд' }),
  ).toHaveLength(0);
  expect(screen.getByText(currentAddress)).toBeDefined();
  const court = await screen.findByRole('article', { name: /Адрес суда/ });
  const options = within(court).getByRole('region', {
    name: 'Варианты модели',
  });
  expect(within(options).getByText(courtAddress)).toBeDefined();
  expect(within(options).getByText(alternative)).toBeDefined();
  const links = within(options).getAllByRole('link', { name: 'Контакты суда' });
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    contactUrl,
    contactUrl,
  ]);
  const [firstOption] = within(options).getAllByRole('button', {
    name: 'Подставить суд и адрес',
  });
  if (!firstOption) throw new Error('EXPECTED_COURT_ADDRESS_CHOICE');
  await userEvent.setup().click(firstOption);
  await findField('Адрес суда');
  expect(screen.getAllByDisplayValue(courtName).length).toBeGreaterThan(0);
  expect(screen.getAllByDisplayValue(courtAddress).length).toBeGreaterThan(0);
  expect(screen.queryByDisplayValue(alternative)).toBeNull();
});

test('chooses one registry entry for an existing obligation and keeps the entered amount', async () => {
  const row = {
    name: 'ООО «Меридиан»',
    basis: 'Договор № 15',
    amount: '720.50',
  };
  const initial = viewWith({ debts: [row] });
  const creditorPackage = documentPackageSchema.parse({
    ...pack,
    fields: [
      {
        key: 'debts',
        label: 'Кредиторы',
        kind: 'rows',
        multiline: false,
        limits: {},
        columns: [
          { key: 'name', label: 'Название из договора', maxLength: 100 },
          { key: 'basis', label: 'Договор', maxLength: 100 },
          { key: 'amount', label: 'Сумма', maxLength: 100 },
          {
            key: 'creditorLegalName',
            label: 'Полное наименование по реестру',
            maxLength: 100,
          },
          { key: 'inn', label: 'ИНН', maxLength: 10 },
          { key: 'ogrn', label: 'ОГРН', maxLength: 13 },
        ],
      },
    ],
  });
  const first =
    'https://pb.nalog.ru/search.html#mode=search-ul&queryUl=1027700132195';
  const candidates: WorkView['facts']['candidates'] = [
    [
      '1027700132195',
      '7707083893',
      'Общество с ограниченной ответственностью «Меридиан»',
    ],
    [
      '1217700060820',
      '9703026898',
      'Общество с ограниченной ответственностью «Меридиан»',
    ],
  ].map(([ogrn, inn, creditorLegalName]) => ({
    field: 'debts',
    selected: false,
    origin: 'inference',
    explanation: 'Есть одноимённые организации. Сверьте ИНН.',
    evidence: [
      { documentId: crypto.randomUUID(), imagePath: null, quote: row.name },
    ],
    value: [
      {
        ...row,
        amount: '8000.00',
        creditorLegalName: creditorLegalName ?? null,
        inn: inn ?? null,
        ogrn: ogrn ?? null,
      },
    ],
    creditorSource: {
      registry: 'fns',
      url:
        'https://pb.nalog.ru/search.html#mode=search-ul&queryUl=' +
        (ogrn ?? ''),
      checkedAt: '2026-11-20T00:00:00.000Z',
    },
  }));
  installEventSource();
  serveApi(() =>
    json(200, {
      ...initial,
      package: creditorPackage,
      facts: { ...initial.facts, candidates, discrepancyFields: ['debts'] },
    }),
  );
  renderFacts();
  const review = await screen.findByRole('article', { name: /Кредиторы/ });
  const options = within(review).getByRole('region', {
    name: 'Варианты модели',
  });
  const links = within(options).getAllByRole('link', {
    name: 'ЕГРЮЛ (ФНС России)',
  });
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    first,
    'https://pb.nalog.ru/search.html#mode=search-ul&queryUl=1217700060820',
  ]);
  const [choice] = within(options).getAllByRole('button', {
    name: 'Подставить это значение',
  });
  if (!choice) throw new Error('EXPECTED_REGISTRY_CHOICE');
  await userEvent.setup().click(choice);
  expect(await within(review).findByText(/720\.50.*7707083893/u)).toBeDefined();
  expect(within(review).queryByText(/720\.50.*9703026898/u)).toBeNull();
});

test('an internal link asks before discarding edits, and staying preserves the draft', async () => {
  window.location.href = 'http://localhost/w/workspace-1/works/current';
  serveWork(viewWith({ personName: 'Иван' }));
  renderFacts();
  const user = userEvent.setup();
  await typeInto(await findField('ФИО полностью'), 'Новая запись');
  const address = window.location.href;
  await user.click(screen.getByRole('link', { name: 'Все работы' }));
  expect(await screen.findByRole('alertdialog')).toBeDefined();
  await user.click(screen.getByRole('button', { name: 'Остаться' }));
  expect(personName().value).toBe('Новая запись');
  expect(window.location.href).toBe(address);
  expect(navigation.calls).toEqual([]);
  await user.click(screen.getByRole('link', { name: 'Все работы' }));
  await user.click(screen.getByRole('button', { name: 'Уйти' }));
  expect(navigation.calls).toContainEqual({
    method: 'push',
    href: '/w/workspace-1/works',
  });
});

test('a clean form does not block internal links', async () => {
  window.location.href = 'http://localhost/w/workspace-1/works/current';
  serveWork(viewWith({ personName: 'Иван' }));
  renderFacts();
  await findField('ФИО полностью');
  const link = screen.getByRole('link', { name: 'Все работы' });
  const click = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    button: 0,
  });
  expect(link.dispatchEvent(click)).toBe(true);
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

test('after saving, a link is no longer blocked', async () => {
  window.location.href = 'http://localhost/w/workspace-1/works/current';
  serveWork(viewWith({ personName: 'Иван' }));
  renderFacts();
  await typeInto(await findField('ФИО полностью'), 'Новая запись');
  const user = userEvent.setup();
  await user.click(saveButton());
  await waitFor(() => {
    expect(strip()).toBeNull();
  });
  const link = screen.getByRole('link', { name: 'Все работы' });
  const click = new MouseEvent('click', { bubbles: true, cancelable: true });
  expect(link.dispatchEvent(click)).toBe(true);
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

test('modified clicks and links opening a new tab do not block the dirty form', async () => {
  window.location.href = 'http://localhost/w/workspace-1/works/current';
  serveWork(viewWith({ personName: 'Иван' }));
  renderFacts();
  await typeInto(await findField('ФИО полностью'), 'Новая запись');
  const link = screen.getByRole('link', { name: 'Все работы' });
  const newTab = screen.getByRole('link', { name: 'В новой вкладке' });
  let reachedLink = 0;
  for (const item of [link, newTab]) {
    item.addEventListener('click', (event) => {
      reachedLink++;
      event.preventDefault();
    });
  }
  act(() => {
    link.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
      }),
    );
    newTab.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
  });
  expect(reachedLink).toBe(2);
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(personName().value).toBe('Новая запись');
});

function renderFacts() {
  navigation.params = { workspace: workspaceId };
  render(
    <QueryClientProvider client={createQueryClient()}>
      <FactsScreen />
    </QueryClientProvider>,
  );
}

// Поле есть дважды: в бумаге документа и в редакторе под ним. Оба связаны с одним значением;
// тест работает с первым, в порядке документа.
async function findField(label: string) {
  await userEvent
    .setup()
    .click(await screen.findByRole('button', { name: 'Черновики документов' }));
  return (await screen.findAllByLabelText(label))[0] as HTMLTextAreaElement;
}
const fieldNamed = (label: string) =>
  screen.getAllByLabelText(label)[0] as HTMLTextAreaElement;
const personName = () => fieldNamed('ФИО полностью');
const observations = () => fieldNamed('Дополнительные сведения');
const strip = () =>
  screen.queryByRole('region', { name: 'Несохранённые правки' });
const saveButton = () => screen.getByRole('button', { name: 'Сохранить' });
const conflictBlock = () =>
  screen.getByRole('region', { name: 'Изменено и вами, и на сервере' });

async function typeInto(field: HTMLTextAreaElement, text: string) {
  const user = userEvent.setup();
  await user.clear(field);
  await user.type(field, text);
}

test('an edit of a field shows the unsaved strip with cancel and save actions', async () => {
  serveWork(viewWith({ personName: 'Иван' }));
  renderFacts();
  await typeInto(await findField('ФИО полностью'), 'Иван Петров');

  expect(
    (await screen.findByRole('region', { name: 'Несохранённые правки' }))
      .textContent,
  ).toContain('Есть несохранённые правки');
  expect(saveButton().hasAttribute('disabled')).toBe(false);
});

test('a dotted field supplied only by the server catalogue is submitted as one literal key', async () => {
  const base = viewWith({});
  const server = serveWork({
    ...base,
    package: {
      ...base.package,
      fields: [
        ...base.package.fields,
        {
          key: 'new.profile_field2',
          label: 'Новое поле профиля',
          multiline: false,
          kind: 'text',
          limits: { maxLength: 20 },
          columns: [],
        },
      ],
    },
  });
  renderFacts();
  const input = await findField('Новое поле профиля');
  await typeInto(input, 'После');
  await userEvent.setup().click(saveButton());
  await waitFor(() => {
    const post = server.exchanges.find((item) => item.method === 'PATCH');
    expect(post?.body).toMatchObject({
      values: { 'new.profile_field2': 'После' },
    });
    expect(
      (post?.body as { values: Record<string, unknown> }).values.new,
    ).toBeUndefined();
  });
});

test('the form resets to the new server revision before applying its carried edit', async () => {
  const server = serveWork(
    viewWith({ personName: 'Иван', observations: 'Старое' }),
  );
  renderFacts();
  await typeInto(await findField('ФИО полностью'), 'Иван Петров');

  server.change(
    viewWith({ personName: 'Иван', observations: 'Новое' }, { revision: 2 }),
  );
  server.announceChange();

  await waitFor(() => {
    expect(observations().value).toBe('Новое');
  });
  expect(personName().value).toBe('Иван Петров');
  expect(
    screen.queryByRole('heading', { name: 'Изменено и вами, и на сервере' }),
  ).toBeNull();
  expect(strip()).not.toBeNull();
});

test('a same-revision refetch does not reapply a previous form reset', async () => {
  const server = serveWork(
    viewWith({ personName: 'Иван', observations: 'Первое' }),
  );
  renderFacts();
  await typeInto(await findField('ФИО полностью'), 'Моя первая правка');
  server.change(
    viewWith({ personName: 'Иван', observations: 'Второе' }, { revision: 2 }),
  );
  server.announceChange();
  await waitFor(() => {
    expect(observations().value).toBe('Второе');
  });
  await typeInto(personName(), 'Моя новая правка');
  const refetched = viewWith(
    { personName: 'Иван', observations: 'Третье' },
    { revision: 2 },
  );
  server.change({
    ...refetched,
    package: { ...refetched.package, title: 'Ответ обработан' },
  });
  server.announceChange();
  await screen.findByText('Ответ обработан');
  expect(personName().value).toBe('Моя новая правка');
});

test('a removed profile field shows its edit conflict with only the server action', async () => {
  const base = viewWith({ removedField: 'Старое значение' });
  const server = serveWork({
    ...base,
    package: {
      ...base.package,
      fields: [
        ...base.package.fields,
        {
          key: 'removedField',
          label: 'Удаляемое поле',
          multiline: false,
          kind: 'text',
          limits: { maxLength: 40 },
          columns: [],
        },
      ],
    },
  });
  renderFacts();
  await typeInto(await findField('Удаляемое поле'), 'Моя правка');
  server.change(viewWith({}, { revision: 2 }));
  server.announceChange();
  const conflicts = await screen.findByRole('region', {
    name: 'Изменено и вами, и на сервере',
  });
  expect(within(conflicts).getByText('Моя правка')).toBeTruthy();
  expect(
    within(conflicts)
      .getByRole('button', { name: 'Оставить моё' })
      .hasAttribute('disabled'),
  ).toBe(true);
  await userEvent
    .setup()
    .click(within(conflicts).getByRole('button', { name: 'Взять с сервера' }));
  expect(
    screen.queryByRole('region', { name: 'Изменено и вами, и на сервере' }),
  ).toBeNull();
  expect(strip()).toBeNull();
});

test('an edit conflict shows both values and disables the save button', async () => {
  const server = serveWork(viewWith({ personName: 'Иван' }));
  renderFacts();
  await typeInto(await findField('ФИО полностью'), 'Иван Петров');

  server.change(viewWith({ personName: 'Иван Сергеевич' }, { revision: 2 }));
  server.announceChange();

  expect(
    await screen.findByRole('heading', {
      name: 'Изменено и вами, и на сервере',
    }),
  ).toBeTruthy();
  expect(
    screen.getByText('Работа изменилась: 1 поле изменено и вами, и на сервере'),
  ).toBeTruthy();
  expect(saveButton().hasAttribute('disabled')).toBe(true);
  const block = conflictBlock();
  expect(within(block).getByText('Иван Петров')).toBeTruthy();
  expect(within(block).getByText('Иван Сергеевич')).toBeTruthy();
});

test('the keep button resolves the edit conflict and enables saving the displayed value', async () => {
  const server = serveWork(viewWith({ personName: 'Иван' }));
  renderFacts();
  await typeInto(await findField('ФИО полностью'), 'Иван Петров');
  server.change(viewWith({ personName: 'Иван Сергеевич' }, { revision: 2 }));
  server.announceChange();
  await screen.findByRole('button', { name: 'Оставить моё' });

  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Оставить моё' }));

  expect(
    screen.queryByRole('heading', { name: 'Изменено и вами, и на сервере' }),
  ).toBeNull();
  expect(saveButton().hasAttribute('disabled')).toBe(false);
  expect(personName().value).toBe('Иван Петров');
});

test('the take button applies the server value and hides the unsaved strip', async () => {
  const server = serveWork(viewWith({ personName: 'Иван' }));
  renderFacts();
  await typeInto(await findField('ФИО полностью'), 'Иван Петров');
  server.change(viewWith({ personName: 'Иван Сергеевич' }, { revision: 2 }));
  server.announceChange();
  await screen.findByRole('button', { name: 'Взять с сервера' });

  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Взять с сервера' }));

  await waitFor(() => {
    expect(strip()).toBeNull();
  });
  expect(personName().value).toBe('Иван Сергеевич');
});

test('saving sends the values with the revision the edits started from and the strip disappears after the answer', async () => {
  const server = serveWork(viewWith({ personName: 'Иван' }, { revision: 1 }));
  renderFacts();
  await typeInto(await findField('ФИО полностью'), 'Иван Петров');

  const user = userEvent.setup();
  await user.click(saveButton());

  await waitFor(() => {
    expect(strip()).toBeNull();
  });
  const saved = server.exchanges.find((item) => item.method === 'PATCH');
  expect(saved?.url).toBe(`${workAddress}/fields`);
  expect(saved?.idempotencyKey).toBeNull();
  expect(saved?.body).toMatchObject({
    revision: 1,
    values: { personName: 'Иван Петров' },
  });
  expect(personName().value).toBe('Иван Петров');
});

test('cancel returns the fields to the server values and hides the strip', async () => {
  serveWork(viewWith({ personName: 'Иван' }));
  renderFacts();
  await typeInto(await findField('ФИО полностью'), 'Иван Петров');

  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Отменить' }));

  expect(strip()).toBeNull();
  expect(personName().value).toBe('Иван');
});

test('a save refused as a revision conflict explains it, reloads the work and keeps the edits that do not conflict', async () => {
  const server = serveWork(
    viewWith({ personName: 'Иван', observations: 'Старое' }),
  );
  renderFacts();
  await typeInto(await findField('ФИО полностью'), 'Иван Петров');
  server.answerNextSaveWith(() => {
    server.change(
      viewWith({ personName: 'Иван', observations: 'Новое' }, { revision: 2 }),
    );
    return json(409, { error: { code: 'REVISION_CONFLICT', requestId: 'r' } });
  });

  const user = userEvent.setup();
  await user.click(saveButton());

  expect(
    await screen.findByText(
      'Работа изменилась во время сохранения. Правки перенесены на новую версию: проверьте их и сохраните ещё раз.',
    ),
  ).toBeTruthy();
  await waitFor(() => {
    expect(observations().value).toBe('Новое');
  });
  expect(personName().value).toBe('Иван Петров');
  expect(strip()).not.toBeNull();
});

test('unsaved edits prevent the page from closing, and a clean form does not', async () => {
  serveWork(viewWith({ personName: 'Иван' }));
  renderFacts();
  await findField('ФИО полностью');

  const clean = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(clean);
  expect(clean.defaultPrevented).toBe(false);

  await typeInto(personName(), 'Иван Петров');
  const dirty = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(dirty);
  expect(dirty.defaultPrevented).toBe(true);
});

test('while the source is being cleaned up the fields are locked and the edits are dropped', async () => {
  const server = serveWork(viewWith({ personName: 'Иван' }));
  renderFacts();
  await typeInto(await findField('ФИО полностью'), 'Иван Петров');
  expect(strip()).not.toBeNull();

  server.change(viewWith({ personName: 'Иван' }, { cleanupPending: true }));
  // Перечитывание вида завершается вне действий пользователя: act ждёт его до проверки. waitFor в этой
  // среде не видит перерисовку после снятия полосы, хотя состояние уже обновлено.
  await act(async () => {
    server.announceChange();
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
  expect(strip()).toBeNull();
  expect(personName().value).toBe('Иван');
  expect(personName().hasAttribute('disabled')).toBe(true);
});

test('a work that is already being cleaned up opens without edits and with locked fields', async () => {
  serveWork(viewWith({ personName: 'Иван' }, { cleanupPending: true }));
  renderFacts();

  expect(await findField('ФИО полностью')).toBeTruthy();
  expect(personName().hasAttribute('disabled')).toBe(true);
  expect(strip()).toBeNull();
});

test('employment review exposes the calculation inputs and the statement uses one employer', async () => {
  const initial = viewWith({
    documentDate: '14.03.2026',
    employmentHistory: [
      { employer: 'ООО Север', date: '05.04.2025', event: 'Приём' },
      { employer: 'ООО Север', date: '10.02.2026', event: 'Увольнение' },
      { employer: 'ООО Юг', date: '23.02.2026', event: 'Приём' },
    ],
    employmentIncome: [
      { employer: 'ООО Север', month: '2026-01', amount: '90000.01' },
      { employer: 'ООО Север', month: '2026-02', amount: '30000.00' },
      { employer: 'ООО Юг', month: '2026-02', amount: '10000.00' },
      {
        employer: 'ООО Юг',
        month: '2026-03',
        amount: '70000.00',
        code: '2000',
      },
      {
        employer: 'ООО Юг',
        month: '2026-03',
        amount: '10000.00',
        code: '2002',
      },
    ],
  });
  const employmentPackage = documentPackageSchema.parse({
    ...pack,
    fields: ['employmentHistory', 'employmentIncome'].map((key) => ({
      key,
      label: key,
      kind: 'rows',
      multiline: false,
      limits: {},
      columns: [{ key: 'employer', label: 'Работодатель', maxLength: 4000 }],
    })),
    documents: [
      {
        ...pack.documents[0],
        id: 'statement',
        blocks: [
          { kind: 'paragraph', paragraph: paragraph('{employmentDetails}') },
        ],
      },
    ],
  });
  installEventSource();
  serveApi(() => json(200, { ...initial, package: employmentPackage }));
  renderFacts();

  const calculation = await screen.findByRole('region', {
    name: 'Работа и средний доход',
  });
  expect(
    within(calculation).getByText(/Учтено месяцев — 3/).textContent,
  ).toContain('2026-01, 2026-02, 2026-03');
  expect(
    within(calculation).getByText(/2026-01 · ООО Север · 90000,01/),
  ).toBeDefined();
  expect(
    within(calculation).getByText(/2026-02 · ООО Юг · 10000,00/),
  ).toBeDefined();
  expect(
    within(calculation).getByText(/2026-03 · ООО Юг · 10000,00/).textContent,
  ).toContain('код 2002');
  expect(within(calculation).getByText('60900,00 руб.')).toBeDefined();

  await userEvent.click(
    screen.getByRole('button', { name: 'Черновики документов' }),
  );
  const statement = await screen.findByRole('article', { name: 'Заявление' });
  expect(statement.textContent).toContain(
    'В настоящее время работаю в ООО Юг.',
  );
  expect(statement.textContent).toContain('60900,00 руб.');
  expect(statement.textContent).not.toContain('ООО Север');
});
