import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';

import PizZip from 'pizzip';

import { formatCalendarDate } from '@anyko/document-values/calendar-date';
import {
  canonicalMoneyAmount,
  formatMoneyAmount,
  moneyAmountsInText,
} from '@anyko/document-values/money';
import { diagnoseFailure } from '@anyko/logger';

import { generateDocument } from '../src/modules/generation';
import {
  availablePackages,
  requirePackage,
  templateBytes,
  templateData,
} from '../src/modules/templates';
import { candidateSchema } from '../src/profiles/bfl/candidate';
import {
  emptyFieldValues,
  fieldValuesSchema,
} from '../src/profiles/bfl/fields';

test('the selectable package contains three real versioned templates; archived single-document works still resolve', () => {
  const packages = availablePackages();
  expect(packages).toHaveLength(1);
  expect(packages[0]?.technical).toBe(false);
  expect(packages[0]?.version).toBe('bfl-bankruptcy-v13');
  expect(requirePackage('bfl-bankruptcy-v6').documents[0]?.version).toBe(
    'bfl-statement-v6',
  );
  expect(packages[0]?.documents.map((doc) => doc.id)).toEqual([
    'statement',
    'inventory',
    'creditors',
  ]);
  expect(requirePackage('technical-document-v1').documents).toHaveLength(1);
});

test.each([
  [
    () => requirePackage('not-a-package'),
    'PACKAGE_NOT_FOUND',
    'templates.requirePackage',
  ],
  [
    () => templateBytes('not-a-template'),
    'TEMPLATE_NOT_FOUND',
    'templates.readAsset',
  ],
] as const)(
  'retains the diagnostic code of a missing template reference',
  (read, code, operation) => {
    let diagnostic: unknown;
    try {
      read();
    } catch (error) {
      diagnostic = diagnoseFailure(error, {
        code: 'INTERNAL_ERROR',
        message: 'Не удалось открыть каталог.',
        operation: 'catalog.load',
      });
    }
    expect(diagnostic).toMatchObject({ code, operation });
  },
);

test.each([
  [
    '30.08.2003',
    'D_WORDS MMMM YYYY_WORDS года',
    'тридцатое августа две тысячи третьего года',
  ],
  [
    '03.09.2000',
    'D_WORDS MMMM YYYY_WORDS года',
    'третье сентября двухтысячного года',
  ],
  [
    '31.12.1900',
    'D_GENITIVE_WORDS MMMM YYYY_WORDS года',
    'тридцать первого декабря тысяча девятисотого года',
  ],
  [
    '09.11.2026',
    'D_GENITIVE_WORDS MMMM YYYY_WORDS года',
    'девятого ноября две тысячи двадцать шестого года',
  ],
  [
    '21.05.1945',
    'D_WORDS MMMM YYYY_WORDS года',
    'двадцать первое мая тысяча девятьсот сорок пятого года',
  ],
  ['29.02.2023', 'D_WORDS MMMM YYYY_WORDS года', '29.02.2023'],
])('formats %s with %s', (value, placeholder, expected) => {
  expect(formatCalendarDate(value, placeholder)).toBe(expected);
});

test('slot aliases read original facts even when a previous slot uses the same name', () => {
  const values = {
    ...emptyFieldValues(),
    birthDate: '02.03.2024',
    passportIssuedAt: '04.05.2025',
  };
  const output = templateData(values, 'bfl-statement-v5', [
    {
      tag: 'birthDate',
      field: 'passportIssuedAt',
      placeholder: 'D MMMM YYYY года',
    },
    { tag: 'documentDate', field: 'birthDate', placeholder: 'DD.MM.YYYY' },
  ]);
  expect(output.birthDate).toBe('4 мая 2025 года');
  expect(output.documentDate).toBe('02.03.2024');
});

test('identity metadata preserves raw dates, collections and computed bindings in archived templates', () => {
  const values = {
    ...emptyFieldValues(),
    passportIssuedAt: '30/08/2003',
    lastName: 'Иванова',
    firstName: 'Анна',
    debts: [{ amount: '100.00' }],
  };
  const slots = ['passportIssuedAt', 'debts', 'debts.amount', 'signerName'].map(
    (key) => ({
      tag: key,
      field: key,
      placeholder: 'identity' as const,
    }),
  );
  const version = 'bfl-statement-v4';
  const output = templateData(values, version, slots);
  expect(output).toEqual(templateData(values, version));
  const xml = new PizZip(generateDocument(templateBytes(version), output))
    .file('word/document.xml')
    ?.asText();
  expect(xml).toContain('30/08/2003');
  expect(xml).toContain('100.00');
  expect(xml).toContain('Иванова А.');
});

test('one saved date uses the format of each statement slot and old statement versions preserve their substitution', () => {
  const values = { ...emptyFieldValues(), passportIssuedAt: '30/08/2003' };
  const formats = [
    {
      field: 'passportIssuedAt',
      tag: 'passportIssuedAt',
      placeholder: 'DD.MM.YYYY',
    },
    {
      field: 'passportIssuedAt',
      tag: 'passportIssuedAtText',
      placeholder: 'D MMMM YYYY года',
    },
  ] as const;
  const current = requirePackage('bfl-bankruptcy-v5').documents[0];
  const historical = requirePackage('bfl-bankruptcy-v4').documents[0];
  if (!current || !historical) throw new Error('Statement missing');
  const rendered = (
    version: string,
    slots: readonly (typeof formats)[number][] = formats,
  ) =>
    new PizZip(
      generateDocument(
        templateBytes(version),
        templateData(values, version, slots),
      ),
    )
      .file('word/document.xml')
      ?.asText();
  expect(rendered(current.version)).toContain('30.08.2003');
  expect(rendered(current.version)).toContain('30 августа 2003 года');
  expect(rendered(current.version)).not.toContain('passportIssuedAtText');
  expect(rendered(historical.version, [])?.match(/30\/08\/2003/g)).toHaveLength(
    2,
  );
});

test('the same precise ruble amount is rendered numerically and in the requested case', () => {
  const value = 'одна тысяча двести тридцать четыре рубля, пять копеек';
  expect(canonicalMoneyAmount(value)).toBe('1234.05');
  expect(canonicalMoneyAmount('9 007 199 254 740 993,09')).toBe(
    '9007199254740993.09',
  );
  expect(canonicalMoneyAmount('1 234,05 ₽')).toBe('1234.05');
  expect(canonicalMoneyAmount('100руб.05коп.')).toBe('100.05');
  expect(canonicalMoneyAmount('− 100 р. 1 к.')).toBe('-100.01');
  expect(canonicalMoneyAmount('двадцать одиннадцать рублей')).toBeUndefined();
  expect(moneyAmountsInText('Сумма 100 руб. 01 коп.')).toEqual(['100.01']);
  expect(moneyAmountsInText('Итого 12 3456 руб.')).toEqual([]);
  expect(formatMoneyAmount('1234.05', 'RUB_GENITIVE_WORDS')).toBe(
    'одной тысячи двухсот тридцати четырёх рублей пяти копеек',
  );
  const fields = {
    ...emptyFieldValues(),
    debtTotal: value,
    debtTotalWords: 'Независимый старый текст',
  };
  const formats = [
    { tag: 'debtTotal', field: 'debtTotal', placeholder: 'RUB_DECIMAL' },
    { tag: 'debtTotalWords', field: 'debtTotal', placeholder: 'RUB_WORDS' },
  ] as const;
  const version = 'bfl-statement-v6';
  const output = templateData(fields, version, formats);
  const xml = new PizZip(generateDocument(templateBytes(version), output))
    .file('word/document.xml')
    ?.asText();
  expect(xml).toContain('1234,05');
  expect(xml).toContain('одна тысяча двести тридцать четыре рубля пять копеек');
  expect(xml).not.toContain('Независимый старый текст');
  expect(templateData(fields, 'bfl-statement-v5').debtTotalWords).toBe(
    'Независимый старый текст',
  );
});

test.each([
  ['Итого 100 российских рублей 01 копейка', ['100.01']],
  ['Итого 100 рублей 01 копейку', ['100.01']],
  ['Итого 100 (сто) рублей 01 копейка', []],
  ['Итого 100 рублей (сто рублей) 01 копейка', []],
  ['Итого 100 руб. (сто) 01 коп.', []],
  ['Итого 100 рублей 01 (одна) копейка', []],
  ['Итого 100 рублей (01 копейка)', []],
  ['Итого 100 рублей (сумма (сто) 01 коп.)', []],
  ['Итого 100 рублей (01 копейка', []],
  ['Итого 100 рублей, в том числе 01 копейка', []],
  ['Итого 100 белорусских рублей 01 копейка', []],
  ['Итого 100 бел.руб.', []],
  ['Итого 100 долларов 50 центов', []],
  ['Итого 100 рублей −01 копейка', []],
  ['Итого 100 рублей 01 копейке', []],
  ['Итого 01 копейка', []],
  ['Банк А | 1 200,01', ['1200.01']],
  ['100 белорусских рублей; итог 100,01', ['100.01']],
  ['100 рублей, 200 рублей 01 копейка', ['100.00', '200.01']],
  ['100 рублей | 01 копейка', ['100.00']],
])('finds exact ruble amounts in %s', (quote, expected) => {
  expect(moneyAmountsInText(quote)).toEqual(expected);
});

test('each DOCX keeps its source styles, page geometry and structured tables and renders the shared identity and repeated rows', () => {
  const pack = requirePackage('bfl-bankruptcy-v4');
  const values = emptyFieldValues();
  Object.assign(values, {
    lastName: 'Тестовый',
    firstName: 'Пётр',
    middleName: 'Сергеевич',
    documentNumber: '0000 123456',
    documentDate: '05.11.2026',
    attachments: [
      { description: 'Синтетическое приложение А' },
      { description: 'Синтетическое приложение Б' },
    ],
    debts: [
      {
        name: 'Синтетический кредитор А',
        basis: 'Договор А',
        amount: '100.00',
      },
      {
        name: 'Синтетический кредитор Б',
        basis: 'Договор Б',
        amount: '200.00',
      },
    ],
    realEstate: [
      { description: 'Синтетическая квартира А', address: 'Адрес А' },
      { description: 'Синтетическая квартира Б', address: 'Адрес Б' },
    ],
  });
  for (const template of pack.documents) {
    const source = templateBytes(template.version);
    expect(createHash('sha256').update(source).digest('hex')).toBe(
      template.checksum,
    );
    const zip = new PizZip(source);
    const rendered = new PizZip(
      generateDocument(source, templateData(values, template.version)),
    );
    const xml = rendered.file('word/document.xml')?.asText() ?? '';
    expect(xml).toContain('Тестовый');
    expect(xml).toContain('Пётр');
    expect(xml).toContain('Сергеевич');
    expect(xml).toContain('05.11.2026');
    expect(xml).not.toMatch(/\{[#/a-zA-Z][^}]*\}/);
    for (const part of [
      'word/styles.xml',
      'word/numbering.xml',
      'word/theme/theme1.xml',
    ])
      expect(rendered.file(part)?.asText()).toBe(zip.file(part)?.asText());
    expect(xml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0]).toBe(
      zip
        .file('word/document.xml')
        ?.asText()
        .match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0],
    );
    if (template.id !== 'inventory') {
      expect(xml).toContain('Синтетический кредитор А');
      expect(xml).toContain('Синтетический кредитор Б');
    }
    if (template.id === 'inventory') {
      expect(xml).toContain('Синтетическая квартира А');
      expect(xml).toContain('Синтетическая квартира Б');
    }
    if (template.id === 'statement') {
      expect(xml).toContain('Тестовый Пётр Сергеевич');
      expect(xml).toContain('______________________  Тестовый П.С.');
      expect(xml).not.toContain(
        '______________________  Тестовый Пётр Сергеевич',
      );
      const attachments = (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []).filter(
        (paragraph) => paragraph.includes('Синтетическое приложение'),
      );
      expect(attachments).toHaveLength(2);
      expect(
        attachments.every((paragraph) => paragraph.includes('<w:numPr>')),
      ).toBe(true);
    }
  }
});

test('a statement signature uses only available initials without changing the name in the facts', () => {
  const values = {
    ...emptyFieldValues(),
    lastName: 'Иванова',
    firstName: ' ёлка ',
  };
  const data = templateData(values);
  expect(data.signerName).toBe('Иванова Ё.');
  expect(values.firstName).toBe(' ёлка ');
  expect(templateData({ ...values, lastName: null }).signerName).toBe(
    '[не заполнено]',
  );
});

test('unknown collections do not become absence, and an empty package never contains source-case defaults', () => {
  const values = emptyFieldValues();
  const pack = requirePackage('bfl-bankruptcy-v3');
  const unknown =
    new PizZip(
      generateDocument(templateBytes('bfl-inventory-v1'), templateData(values)),
    )
      .file('word/document.xml')
      ?.asText() ?? '';
  expect(unknown).toContain('[не заполнено]');
  expect(unknown).not.toContain('Отсутствует');
  values.realEstate = [];
  const absent =
    new PizZip(
      generateDocument(templateBytes('bfl-inventory-v1'), templateData(values)),
    )
      .file('word/document.xml')
      ?.asText() ?? '';
  expect(absent).toContain('Отсутствует');
  for (const template of pack.documents) {
    const zip = new PizZip(templateBytes(template.version));
    expect(zip.file('docProps/core.xml')?.asText()).not.toMatch(
      /<dc:creator|<cp:lastModifiedBy/,
    );
    expect(zip.file('word/document.xml')?.asText()).toContain('{lastName}');
  }
});

test('runtime field validation rejects mixing text and tables and unknown columns', () => {
  expect(
    fieldValuesSchema.safeParse({ ...emptyFieldValues(), debts: 'text' })
      .success,
  ).toBe(false);
  expect(
    fieldValuesSchema.safeParse({
      ...emptyFieldValues(),
      firstName: [{ name: 'wrong' }],
    }).success,
  ).toBe(false);
  expect(
    candidateSchema.safeParse({
      field: 'debts',
      value: [{ accountPassword: 'forbidden column' }],
      evidence: [
        { documentId: crypto.randomUUID(), imagePath: null, quote: 'text' },
      ],
    }).success,
  ).toBe(false);
});

test('the chosen request and explicit absence of attachments cannot be contradicted by a source-case default', () => {
  const values = {
    ...emptyFieldValues(),
    requestsDetails: 'Ввести процедуру реструктуризации долгов',
    attachments: [],
  };
  const xml =
    new PizZip(
      generateDocument(
        templateBytes('bfl-statement-v4'),
        templateData(values, 'bfl-statement-v4'),
      ),
    )
      .file('word/document.xml')
      ?.asText() ?? '';
  expect(xml).toContain('Ввести процедуру реструктуризации долгов');
  expect(xml).not.toContain(
    'Признать меня банкротом и ввести процедуру реализации имущества гражданина',
  );
  expect(xml).not.toContain('прилагаю');
  expect(xml).not.toContain('подтверждаются приложенными документами');
  expect(xml).not.toContain('Отсутствует');
});

test('the current package uses one active contract total in both DOCX files', () => {
  const pack = requirePackage('bfl-bankruptcy-v8');
  const values = {
    ...emptyFieldValues(),
    debtTotal: '99999',
    debts: [
      {
        name: 'АО Синтетический Банк',
        contractNumber: 'ACT-001',
        contractDate: '2025-01-03',
        amountDate: '2026-11-08',
        debtStatus: 'Действует',
        amount: '1234.05',
        penalties: '57.12',
      },
      {
        name: 'АО «Синтетический Банк»',
        contractNumber: 'ACT-001',
        contractDate: '03.01.2025',
        amountDate: '2026-11-09',
        debtStatus: 'Действует',
        amount: '1234.05',
      },
      {
        name: 'АО «Синтетический Банк»',
        contractNumber: 'ACT-002',
        contractDate: '2025-02-06',
        amountDate: '2026-11-08',
        debtStatus: 'Действует',
        amount: '200.06',
      },
      {
        name: 'Другой закрытый кредитор',
        contractNumber: 'PAID-003',
        contractDate: '2024-04-02',
        debtStatus: 'Погашен',
        amount: '462.10',
      },
    ],
  };
  const render = (id: string) => {
    const doc = pack.documents.find((template) => template.id === id);
    if (!doc) throw new Error('Missing template');
    return (
      new PizZip(
        generateDocument(
          templateBytes(doc.version),
          templateData(values, doc.version, doc.placeholders, {
            fields: pack.fields,
            referenceDate: '21.11.2026',
          }),
        ),
      )
        .file('word/document.xml')
        ?.asText() ?? ''
    );
  };
  const statement = render('statement');
  const creditors = render('creditors');
  const header = statement.slice(0, statement.indexOf('</w:tbl>'));
  expect(header.match(/Синтетический Банк/g)).toHaveLength(1);
  for (const xml of [statement, creditors]) {
    expect(xml.match(/ACT-001/g)).toHaveLength(1);
    expect(xml.match(/ACT-002/g)).toHaveLength(1);
    expect(xml).toContain('1 234,05');
    expect(xml).toContain('200,06');
    expect(xml).toContain('1 434,11');
    expect(xml).not.toContain('99999');
    expect(xml).not.toContain('PAID-003');
    expect(xml).not.toContain('57,12');
  }
  expect(statement).toContain(
    'одна тысяча четыреста тридцать четыре рубля одиннадцать копеек',
  );
});

test('the approved statement preserves its predecessor’s OOXML parts and renders the same request as the preview', () => {
  const document = requirePackage('bfl-bankruptcy-v8').documents[0];
  if (!document) throw new Error('Missing statement');
  const source = new PizZip(templateBytes(document.version));
  const predecessor = new PizZip(templateBytes('bfl-statement-v7'));
  expect(Object.keys(source.files)).toEqual(Object.keys(predecessor.files));
  for (const path of Object.keys(source.files)) {
    if (path !== 'word/document.xml')
      expect(source.file(path)?.asText()).toBe(
        predecessor.file(path)?.asText(),
      );
  }
  const sourceXml = source.file('word/document.xml')?.asText() ?? '';
  const requestTexts = document.blocks
    .flatMap((block) =>
      block.kind === 'paragraph' ? [block.paragraph.text] : [],
    )
    .filter((text) =>
      [
        'Признать {requestDebtorName}',
        'Утвердить финансового управляющего',
        'На основании ст. 213.4 п. 4 абз. 2 ФЗ «О несостоятельности',
      ].some((prefix) => text.startsWith(prefix)),
    );
  expect(requestTexts).toHaveLength(3);
  for (const text of requestTexts) expect(sourceXml).toContain(text);
});

test('the v8 statement formats the original evidence, projects default paragraphs and omits blank debt rows', () => {
  const pack = requirePackage('bfl-bankruptcy-v8');
  const doc = pack.documents.find(({ id }) => id === 'statement');
  const inventory = pack.documents.find(({ id }) => id === 'inventory');
  if (!doc || !inventory) throw new Error('Missing templates');
  const values = {
    ...emptyFieldValues(),
    lastName: 'ИВАНОВА',
    firstName: 'ИВАННА',
    middleName: 'ИВАНОВНА',
    birthPlace: 'ГОР. КИРОВ',
    documentNumber: '0000 000000',
    documentDate: '10.03.2026',
    passportIssuer: 'УМВД РОССИИ ПО КИРОВСКОЙ ОБЛАСТИ',
    familyDetails: 'Не состою в браке. На иждивении имею ребёнка.',
    majorTransactionsDetails: 'Подтверждённый текст о сделках.',
    debts: [
      {},
      {
        name: 'АО "ТЕСТОВЫЙ БАНК"',
        creditorLegalName: 'АКЦИОНЕРНОЕ ОБЩЕСТВО "ТЕСТОВЫЙ БАНК"',
        creditorShortName: 'АО "ТЕСТОВЫЙ БАНК"',
        address: 'ГОРОД МОСКВА, УЛ. ТЕСТОВАЯ, Д. 1',
        contractNumber: 'TEST-01',
        amount: '161000.00',
      },
    ],
    realEstate: [],
    employmentHistory: [
      { employer: 'ООО Пример', date: '01.03.2026', event: 'Приём' },
    ],
    employmentIncome: [
      { employer: 'ООО Пример', month: '2026-03', amount: '20000.00' },
    ],
  };
  const context = { fields: pack.fields, referenceDate: '10.03.2026' };
  const data = templateData(values, doc.version, doc.placeholders, context);
  expect(data).toMatchObject({
    lastName: 'Иванова',
    birthPlace: 'гор. Киров',
    documentNumber: '00 00 № 000000',
    passportIssuer: 'УМВД России по Кировской области',
    familyDetails: 'Не состою в браке. На иждивении имею ребёнка.',
    majorTransactionsDetails: 'Подтверждённый текст о сделках.',
    debtTotal: '161 000,00',
    signerName: 'Иванова И.И.',
    debts: [{ amount: '161 000,00', name: 'АО «Тестовый Банк»' }],
    creditorHeaders: [
      {
        name: 'Акционерное общество «Тестовый Банк» (АО «Тестовый Банк»)',
        address: 'город Москва, ул. Тестовая, д. 1',
      },
    ],
  });
  expect(data.employmentDetails).toContain(
    'В настоящее время я, Иванова Иванна Ивановна, осуществляю трудовую деятельность в ООО Пример.',
  );
  expect(data.employmentDetails).toContain(
    '17 400,00 (семнадцать тысяч четыреста рублей ноль копеек), после налогообложения.',
  );
  expect(data.companyParticipationDetails).toContain('не являлась');
  expect(data.liabilityDetails).toContain('не привлекалась');
  expect(data.businessDebts).toEqual([]);
  expect(
    templateData(values, inventory.version, inventory.placeholders, context)
      .realEstate,
  ).toMatchObject([{ description: '-', rowNumber: '-' }]);
  expect(values.lastName).toBe('ИВАНОВА');
});

test('statement projects current-year income across employers and leaves historical fields editable', () => {
  const pack = requirePackage('bfl-bankruptcy-v7');
  const statement = pack.documents[0];
  if (!statement) throw new Error('STATEMENT_MISSING');
  const values = {
    ...emptyFieldValues(),
    employmentHistory: [
      { employer: 'ООО Север', date: '05.04.2025', event: 'Приём' },
      { employer: 'ООО Север', date: '10.02.2026', event: 'Увольнение' },
      { employer: 'ООО Юг', date: '23.02.2026', event: 'Приём' },
    ],
    employmentIncome: [
      { employer: 'ООО Север', month: '2025-12', amount: '900000.00' },
      { employer: 'ООО Север', month: '2026-01', amount: '90000.01' },
      { employer: 'ООО Север', month: '2026-02', amount: '30000.00' },
      { employer: 'ООО Юг', month: '2026-02', amount: '10000.00' },
      { employer: 'ООО Юг', month: '2026-03', amount: '80000.00' },
    ],
  };
  expect(pack.fields.map(({ key }) => key)).toContain('employmentHistory');
  const output = templateData(
    values,
    statement.version,
    statement.placeholders,
    {
      fields: pack.fields,
      referenceDate: '14.03.2026',
    },
  );
  const xml = new PizZip(
    generateDocument(templateBytes(statement.version), output),
  )
    .file('word/document.xml')
    ?.asText();
  expect(xml).toContain('В настоящее время работаю в ООО Юг.');
  expect(xml).toContain('60900,00 руб.');
  expect(xml).not.toContain('ООО Север');

  const historical = requirePackage('bfl-bankruptcy-v6');
  expect(historical.fields.map(({ key }) => key)).not.toContain(
    'employmentHistory',
  );
  expect(
    templateData(
      { ...emptyFieldValues(), employmentDetails: 'Исторический текст' },
      historical.documents[0]?.version,
    ).employmentDetails,
  ).toBe('Исторический текст');
});
