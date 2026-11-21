import { expect, spyOn, test } from 'bun:test';

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';

import { documentPackageSchema } from '@anyko/contracts/catalog';

import { PackagePreview } from './package-preview';
import { emptyFieldValues, fieldDefinitions } from './test-fields';

const paragraph = (text: string) => ({
  text,
  align: 'left',
  bold: false,
  fontSize: 12,
  indent: 0,
  after: 0,
});
const pack = documentPackageSchema.parse({
  id: 'fixture',
  version: 'fixture-v1',
  title: 'Пакет',
  technical: false,
  fields: fieldDefinitions.filter((field) =>
    ['lastName', 'debts', 'businessDebts'].includes(field.key),
  ),
  documents: ['Заявление', 'Опись', 'Кредиторы'].map((title, index) => ({
    id: String(index),
    version: `fixture-${String(index)}`,
    title,
    filename: `${String(index)}.docx`,
    checksum: '0'.repeat(64),
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
                paragraphs: [paragraph('Должник: {lastName}')],
              },
              {
                span: 1,
                merge: 'none',
                paragraphs: [
                  paragraph('{#debts}{name}{/debts}'),
                  paragraph('{#businessDebts}{name}{/businessDebts}'),
                ],
              },
            ],
          },
        ],
      },
    ],
  })),
});

test('the preview renders two slots for one date and edits the underlying fact', () => {
  const editable = documentPackageSchema.parse({
    ...pack,
    fields: [
      {
        key: 'passportIssuedAt',
        label: 'Дата выдачи',
        multiline: false,
        kind: 'text',
        valueType: 'date',
        limits: {},
        columns: [],
      },
    ],
    documents: [
      {
        ...pack.documents[0],
        placeholders: [
          {
            field: 'passportIssuedAt',
            tag: 'passportIssuedAtDigits',
            placeholder: 'DD.MM.YYYY',
          },
          {
            field: 'passportIssuedAt',
            tag: 'passportIssuedAtText',
            placeholder: 'D MMMM YYYY года',
          },
        ],
        blocks: [
          {
            kind: 'paragraph',
            paragraph: paragraph(
              '{passportIssuedAtDigits}; {passportIssuedAtText}',
            ),
          },
        ],
      },
    ],
  });
  const changes: unknown[][] = [];
  render(
    <PackagePreview
      pack={editable}
      values={{ passportIssuedAt: '30/08/2003' }}
      disabled={false}
      onChange={(...args) => changes.push(args)}
    />,
  );
  expect(screen.getByDisplayValue('30.08.2003')).toBeTruthy();
  const written = screen.getByDisplayValue('30 августа 2003 года');
  fireEvent.focus(written);
  expect(screen.getAllByDisplayValue('30/08/2003')).toContain(written);
  fireEvent.change(written, { target: { value: '31.08.2003' } });
  expect(changes).toEqual([['passportIssuedAt', '31.08.2003']]);
});

test('the statement preview identifies attachment paragraphs omitted from the document', () => {
  const statement = documentPackageSchema.parse({
    ...pack,
    documents: [
      {
        ...pack.documents[0],
        id: 'statement',
        version: 'bfl-statement-v10',
        blocks: [
          {
            kind: 'paragraph',
            paragraph: paragraph('{statementAttachmentReferences}'),
          },
          {
            kind: 'paragraph',
            paragraph: paragraph('{statementBalanceConclusion}'),
          },
        ],
      },
    ],
  });
  const selected = {
    documentId: 'package:creditors',
    copyKind: 'paperOriginal',
    description: 'Список кредиторов и должников',
    category: 'other',
  };
  const props = {
    pack: statement,
    disabled: false,
    onChange: () => undefined,
  };
  const { rerender } = render(
    <PackagePreview {...props} values={{ submittedAttachments: [selected] }} />,
  );
  const status = screen.getByRole('status');
  expect(status.textContent).toContain(
    'Абзацы об этих приложениях не войдут в заявление',
  );
  expect(status.textContent).toContain('справки о задолженности');
  expect(status.textContent).toContain('сведения о лицевом счёте');
  expect(status.textContent).toContain('опись имущества');
  expect(status.textContent).not.toContain('список кредиторов');
  expect(screen.getByText(/Список своих кредиторов и должников/)).toBeTruthy();
  expect(screen.queryByText(/в прилагаемой описи/)).toBeNull();

  rerender(
    <PackagePreview
      {...props}
      values={{
        submittedAttachments: [
          selected,
          { ...selected, documentId: 'package:inventory' },
          { ...selected, documentId: 'debt', category: 'debtCertificate' },
          { ...selected, documentId: 'pension', category: 'pensionAccount' },
        ],
      }}
    />,
  );
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.getByText(/в прилагаемой описи/)).toBeTruthy();
});

test('the draft displays one amount with cents and in words', () => {
  const statement = documentPackageSchema.parse({
    ...pack,
    fields: [
      {
        key: 'debtTotal',
        label: 'Сумма',
        multiline: false,
        kind: 'text',
        valueType: 'money',
        limits: {},
        columns: [],
      },
    ],
    documents: [
      {
        ...pack.documents[0],
        placeholders: [
          { field: 'debtTotal', tag: 'debtTotal', placeholder: 'RUB_DECIMAL' },
          {
            field: 'debtTotal',
            tag: 'debtTotalWords',
            placeholder: 'RUB_WORDS',
          },
        ],
        blocks: [
          {
            kind: 'paragraph',
            paragraph: paragraph('{debtTotal} руб. ({debtTotalWords})'),
          },
        ],
      },
    ],
  });
  const changes: unknown[][] = [];
  render(
    <PackagePreview
      pack={statement}
      values={{ debtTotal: '1234.05' }}
      disabled={false}
      onChange={(...args) => changes.push(args)}
    />,
  );
  expect(screen.getByDisplayValue('1234,05')).toBeTruthy();
  const words = screen.getByDisplayValue(
    'одна тысяча двести тридцать четыре рубля пять копеек',
  );
  fireEvent.focus(words);
  fireEvent.change(words, { target: { value: '1234.06' } });
  expect(changes).toEqual([['debtTotal', '1234.06']]);
});

test.each([
  '______________________  {lastName} {firstName} {middleName}',
  '______________________  {signerName}',
])(
  'the statement signature follows the name in the draft for %s',
  (signature) => {
    const statement = documentPackageSchema.parse({
      ...pack,
      documents: [
        {
          ...pack.documents[0],
          id: 'statement',
          blocks: [{ kind: 'paragraph', paragraph: paragraph(signature) }],
        },
      ],
    });
    const values = {
      ...emptyFieldValues(),
      lastName: 'Иванова',
      firstName: 'Елена',
      middleName: 'Андреевна',
    };
    const props = {
      pack: statement,
      values,
      disabled: false,
      onChange: () => undefined,
    };
    const view = render(<PackagePreview {...props} />);
    expect(
      screen.getByLabelText('Фамилия и инициалы подписанта').textContent,
    ).toBe('Иванова Е.А.');
    view.rerender(
      <PackagePreview {...props} values={{ ...values, firstName: 'Юлия' }} />,
    );
    expect(
      screen.getByLabelText('Фамилия и инициалы подписанта').textContent,
    ).toBe('Иванова Ю.А.');
  },
);

test('a find request opens the matching document, preserves it on data refresh and permits later tab selection', async () => {
  const scroll = spyOn(HTMLElement.prototype, 'scrollIntoView');
  const twoDocuments = documentPackageSchema.parse({
    ...pack,
    documents: [
      {
        ...pack.documents[0],
        blocks: [
          { kind: 'paragraph', paragraph: paragraph('Первый документ') },
        ],
      },
      {
        ...pack.documents[1],
        blocks: [
          { kind: 'paragraph', paragraph: paragraph('Имя: {lastName}') },
        ],
      },
    ],
  });
  const props = {
    pack: twoDocuments,
    values: emptyFieldValues(),
    disabled: false,
    onChange: () => undefined,
  };
  const view = render(<PackagePreview {...props} />);
  const focus = { key: 'lastName', nonce: 1 };
  view.rerender(<PackagePreview {...props} focus={focus} />);
  await waitFor(() => {
    expect(
      screen.getByRole('tab', { name: 'Опись' }).getAttribute('aria-selected'),
    ).toBe('true');
  });
  expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  const target = scroll.mock.contexts[0] as HTMLElement;
  expect(target.getAttribute('data-field')).toBe('lastName');
  await waitFor(() => {
    expect(target.hasAttribute('data-review-highlight')).toBe(true);
  });
  view.rerender(
    <PackagePreview
      {...props}
      pack={{ ...twoDocuments, documents: [...twoDocuments.documents] }}
      focus={focus}
    />,
  );
  expect(
    screen.getByRole('tab', { name: 'Опись' }).getAttribute('aria-selected'),
  ).toBe('true');
  fireEvent.click(screen.getByRole('tab', { name: 'Заявление' }));
  expect(
    screen
      .getByRole('tab', { name: 'Заявление' })
      .getAttribute('aria-selected'),
  ).toBe('true');
  view.rerender(<PackagePreview {...props} focus={{ ...focus }} />);
  expect(
    screen
      .getByRole('tab', { name: 'Заявление' })
      .getAttribute('aria-selected'),
  ).toBe('true');
  view.rerender(<PackagePreview {...props} focus={{ ...focus, nonce: 2 }} />);
  await waitFor(() => {
    expect(
      screen.getByRole('tab', { name: 'Опись' }).getAttribute('aria-selected'),
    ).toBe('true');
  });
  scroll.mockRestore();
});

test('package preview exposes all documents and renders nested creditor loops once each without leaking service tags', () => {
  const view = renderToStaticMarkup(
    <PackagePreview
      pack={pack}
      values={{
        ...emptyFieldValues(),
        lastName: '<script>sample</script>',
        debts: [{ name: 'Личный кредитор' }],
        businessDebts: [{ name: 'Предпринимательский кредитор' }],
      }}
      disabled={false}
      onChange={() => undefined}
    />,
  );
  const paper = view.slice(
    view.indexOf('<article'),
    view.indexOf('</article>'),
  );
  expect((view.match(/role="tab"/g) ?? []).length).toBe(3);
  expect((paper.match(/Личный кредитор/g) ?? []).length).toBe(1);
  expect((paper.match(/Предпринимательский кредитор/g) ?? []).length).toBe(1);
  expect(paper).not.toMatch(/\{[#/][a-zA-Z]+\}/);
  expect(paper).not.toContain('<script>');
  expect(paper).toContain('&lt;script&gt;');
});

test('preview renders profile keys with dots, underscores and digits in fields and loops', () => {
  const dynamicPack = documentPackageSchema.parse({
    ...pack,
    fields: [
      {
        key: 'person.full_name2',
        label: 'Новое имя',
        multiline: false,
        kind: 'text',
        limits: { maxLength: 50 },
        columns: [],
      },
      {
        key: 'debts.list_2',
        label: 'Новый список',
        multiline: false,
        kind: 'rows',
        limits: { maxRows: 10 },
        columns: [{ key: 'creditor.name_2', label: 'Кредитор', maxLength: 50 }],
      },
    ],
    documents: [
      {
        ...pack.documents[0],
        blocks: [
          {
            kind: 'paragraph',
            paragraph: paragraph('Имя: {person.full_name2}'),
          },
          {
            kind: 'paragraph',
            paragraph: paragraph(
              '{#debts.list_2}{creditor.name_2}{/debts.list_2}',
            ),
          },
        ],
      },
    ],
  });
  const view = renderToStaticMarkup(
    <PackagePreview
      pack={dynamicPack}
      values={{
        'person.full_name2': 'Иван',
        'debts.list_2': [{ 'creditor.name_2': 'Банк' }],
      }}
      disabled={false}
      onChange={() => undefined}
    />,
  );
  expect(view).toContain('Иван');
  expect(view).toContain('Банк');
  expect(view).not.toContain('{#debts.list_2}');
});

test('repeated rows use their own column labels and limits and preserve a rowNumber column', () => {
  const packWithTables = documentPackageSchema.parse({
    ...pack,
    fields: [
      {
        key: 'first',
        label: 'Первый',
        multiline: false,
        kind: 'rows',
        limits: { maxRows: 10 },
        columns: [{ key: 'name', label: 'Короткое', maxLength: 3 }],
      },
      {
        key: 'second',
        label: 'Второй',
        multiline: false,
        kind: 'rows',
        limits: { maxRows: 10 },
        columns: [
          { key: 'name', label: 'Длинное', maxLength: 20 },
          { key: 'rowNumber', label: 'Реквизит', maxLength: 20 },
        ],
      },
    ],
    documents: [
      {
        ...pack.documents[0],
        blocks: [
          { kind: 'paragraph', paragraph: paragraph('{#first}{name}{/first}') },
          {
            kind: 'paragraph',
            paragraph: paragraph('{#second}{name} {rowNumber}{/second}'),
          },
        ],
      },
    ],
  });
  const view = renderToStaticMarkup(
    <PackagePreview
      pack={packWithTables}
      values={{
        first: [{ name: 'Раз' }],
        second: [{ name: 'Длинное значение', rowNumber: 'Реквизит-77' }],
      }}
      disabled={false}
      onChange={() => undefined}
    />,
  );
  expect(view).toMatch(/aria-label="Заявление: Короткое"[^>]*maxlength="3"/i);
  expect(view).toMatch(/aria-label="Заявление: Длинное"[^>]*maxlength="20"/i);
  expect(view).toContain('Реквизит-77');
  expect(view).toContain('Заявление: Реквизит');
});

test('the latest statement preview groups creditors and shows only active contracts with the shared total', () => {
  const prepared = documentPackageSchema.parse({
    ...pack,
    documents: [
      {
        ...pack.documents[0],
        id: 'statement',
        version: 'bfl-statement-v7',
        blocks: [
          {
            kind: 'paragraph',
            paragraph: paragraph('{#creditorHeaders}{name}{/creditorHeaders}'),
          },
          {
            kind: 'paragraph',
            paragraph: paragraph('{#debts}{basis}: {amount} руб.{/debts}'),
          },
          {
            kind: 'paragraph',
            paragraph: paragraph('Итого: {debtTotal} ({debtTotalWords})'),
          },
        ],
      },
    ],
  });
  render(
    <PackagePreview
      pack={prepared}
      values={{
        debts: [
          { name: 'АО Банк', contractNumber: 'TEST-1', amount: '1.01' },
          { name: 'АО «Банк»', contractNumber: 'TEST-2', amount: '2.02' },
          {
            name: 'Другой банк',
            contractNumber: 'TEST-3',
            debtStatus: 'Закрыт',
            amount: '50.10',
          },
        ],
        debtTotal: '1000',
      }}
      disabled
      onChange={() => {}}
    />,
  );
  const paper = within(screen.getByRole('article', { name: 'Заявление' }));
  expect(paper.getByText('АО Банк')).toBeTruthy();
  expect(paper.queryByText('АО «Банк»')).toBeNull();
  expect(paper.getByText('Договор № TEST-1: 1,01 руб.')).toBeTruthy();
  expect(paper.getByText('Договор № TEST-2: 2,02 руб.')).toBeTruthy();
  expect(paper.queryByText(/TEST-3/)).toBeNull();
  expect(paper.getByText('Итого: 3,03 (три рубля три копейки)')).toBeTruthy();
});

test('the approved statement updates the request from the same name and date the lawyer edits', () => {
  const prepared = documentPackageSchema.parse({
    ...pack,
    version: 'bfl-bankruptcy-v8',
    fields: [
      ...fieldDefinitions.filter(({ key }) => key === 'lastName'),
      ...[
        { key: 'firstName', label: 'Имя' },
        { key: 'middleName', label: 'Отчество' },
        { key: 'documentDate', label: 'Дата заполнения комплекта' },
        { key: 'sroName', label: 'СРО' },
      ].map((field) => ({
        ...field,
        kind: 'text',
        multiline: false,
        limits: {},
        columns: [],
      })),
    ],
    documents: [
      {
        ...pack.documents[0],
        id: 'statement',
        version: 'bfl-statement-v8',
        blocks: [
          'Я, {lastName} {firstName} {middleName}',
          'По состоянию на {documentDate}',
          'Признать {requestDebtorName} {requestInsolvency}',
          'Утвердить управляющего из {sroName}',
          '{documentDate}',
        ].map((text) => ({ kind: 'paragraph', paragraph: paragraph(text) })),
      },
    ],
  });
  const initial = {
    ...emptyFieldValues(),
    lastName: 'Синтетическая',
    firstName: 'Ирина',
    middleName: 'Ильинична',
    documentDate: '20.11.2026',
  };
  const props = { pack: prepared, disabled: false, onChange: () => undefined };
  const { rerender } = render(<PackagePreview {...props} values={initial} />);
  const paper = within(screen.getByRole('article', { name: 'Заявление' }));
  expect(
    paper.getByText(
      'Признать Синтетическую Ирину Ильиничну несостоятельной (банкротом)',
    ),
  ).toBeTruthy();
  expect(paper.getAllByDisplayValue('20.11.2026')).toHaveLength(2);
  expect(paper.getByDisplayValue(/Содружество/)).toBeTruthy();

  rerender(
    <PackagePreview
      {...props}
      values={{
        ...initial,
        lastName: 'Синтетический',
        firstName: 'Николай',
        middleName: 'Ильич',
        documentDate: '21.11.2026',
        sroName: 'Другое объединение управляющих',
      }}
    />,
  );
  expect(
    paper.getByText(
      'Признать Синтетического Николая Ильича несостоятельным (банкротом)',
    ),
  ).toBeTruthy();
  expect(paper.getAllByDisplayValue('21.11.2026')).toHaveLength(2);
  expect(
    paper.getByDisplayValue('Другое объединение управляющих'),
  ).toBeTruthy();
  expect(paper.queryByDisplayValue(/Содружество/)).toBeNull();
});

test('the v8 preview renders display formats and marks editable template defaults', () => {
  const editable = documentPackageSchema.parse({
    ...pack,
    version: 'bfl-bankruptcy-v8',
    fields: [
      ...fieldDefinitions.filter(({ key }) => key === 'lastName'),
      {
        key: 'liabilityDetails',
        label: 'Ответственность',
        kind: 'text',
        multiline: true,
        columns: [],
        limits: {},
      },
    ],
    documents: [
      {
        ...pack.documents[0],
        id: 'statement',
        version: 'bfl-statement-v8',
        blocks: [
          '{lastName}',
          '{liabilityDetails}',
          '{#debts}{basis}: {amount}{/debts}',
          '{#businessDebts}{basis}: {amount}{/businessDebts}',
        ].map((text) => ({ kind: 'paragraph', paragraph: paragraph(text) })),
      },
    ],
  });
  const changes: unknown[][] = [];
  const props = {
    pack: editable,
    disabled: false,
    onChange: (...args: unknown[]) => {
      changes.push(args);
    },
  };
  const values = {
    lastName: 'ИВАНОВА',
    debts: [
      {},
      { name: 'Банк', contractNumber: 'TEST-1', amount: '161000.00' },
    ],
    businessDebts: null,
  };
  const { rerender } = render(<PackagePreview {...props} values={values} />);
  expect(screen.getByDisplayValue('Иванова')).toBeTruthy();
  expect(screen.getByText('Договор № TEST-1: 161 000,00')).toBeTruthy();
  expect(screen.queryByText('[не заполнено]')).toBeNull();
  const defaultInput = screen.getByTitle('Текст шаблона по умолчанию');
  expect(defaultInput).toBe(screen.getByDisplayValue(/не привлекал/));
  fireEvent.change(defaultInput, { target: { value: 'Текст юриста' } });
  expect(changes).toEqual([['liabilityDetails', 'Текст юриста']]);
  rerender(
    <PackagePreview
      {...props}
      values={{ ...values, liabilityDetails: 'Текст юриста' }}
    />,
  );
  expect(
    within(
      screen.getByRole('article', { name: 'Заявление' }),
    ).getByDisplayValue('Текст юриста'),
  ).toBeTruthy();
  expect(screen.queryByTitle('Текст шаблона по умолчанию')).toBeNull();
});
