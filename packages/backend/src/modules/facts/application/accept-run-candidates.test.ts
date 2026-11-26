import { expect, test } from 'bun:test';

import { obligationAmounts } from '@anyko/document-values/obligations';

import {
  type AcceptRunCandidatesInput,
  candidatesForContext,
  emptyFacts,
  type FactsStore,
  markSelectedCandidates,
  type WorkFacts,
} from '..';
import { openTransaction } from '../../../platform/transactions';
import { fieldDefinitions } from '../../../profiles/bfl/fields';
import { createFactsModule } from '../module';

const ref = {
  workspaceId: 'test-workspace',
  workId: '01900000-0000-7000-8000-000000000001',
};
const documentId = '01900000-0000-7000-8000-000000000002';
const otherDocumentId = '01900000-0000-7000-8000-000000000003';
type Candidate = WorkFacts['candidates'][number];

function textCandidate(
  field: Candidate['field'],
  value: string,
  source = documentId,
): Candidate {
  return {
    field,
    value,
    evidence: [{ documentId: source, imagePath: null, quote: value }],
  };
}

function tableCandidate(basis: string, amount: string): Candidate {
  return {
    field: 'debts',
    value: [{ name: 'Тестовый банк', basis, amount }],
    evidence: [
      {
        documentId,
        imagePath: null,
        quote: `Тестовый банк · ${basis} · ${amount}`,
      },
    ],
  };
}

function runFacts(initial = emptyFacts()) {
  let saved = initial;
  const tx = openTransaction({});
  const store: FactsStore = {
    get(workspaceId, workId) {
      expect({ workspaceId, workId }).toEqual(ref);
      return Promise.resolve(saved);
    },
    save(workspaceId, workId, facts) {
      expect({ workspaceId, workId }).toEqual(ref);
      saved = facts;
      return Promise.resolve();
    },
    erase: () => Promise.reject(new Error('Unexpected erase')),
  };
  const facts = createFactsModule({
    store,
    storeFor(boundTx) {
      expect(boundTx).toBe(tx);
      return store;
    },
  });
  return {
    accept: ({
      fields,
      ...input
    }: Omit<
      AcceptRunCandidatesInput,
      keyof typeof ref | 'fields' | 'packageFields'
    > & { fields: readonly string[] }) =>
      facts.in(tx).commands.acceptRunCandidates({
        ...ref,
        ...input,
        fields: fields.map((key) => {
          const field = fieldDefinitions.find((field) => field.key === key);
          if (!field) throw new Error(`Unknown fixture field ${key}`);
          return field;
        }),
        packageFields: fieldDefinitions,
      }),
    saved: () => facts.queries.forAnalysis(ref, fieldDefinitions),
  };
}

test('uses passport spelling and keeps all sources for equivalent text', async () => {
  const facts = runFacts();
  const result = await facts.accept({
    fields: ['lastName', 'firstName', 'middleName', 'birthPlace'],
    confirmed: false,
    passportIds: new Set([documentId]),
    candidates: [
      textCandidate('lastName', 'Иванов', otherDocumentId),
      textCandidate('firstName', 'Иван', otherDocumentId),
      textCandidate('middleName', 'Иванвич', otherDocumentId),
      textCandidate('birthPlace', 'гор.  Киров', otherDocumentId),
      textCandidate('lastName', 'ИВАНОВ'),
      textCandidate('firstName', 'ИВАН'),
      textCandidate('middleName', 'ИВАНОВИЧ'),
      textCandidate('birthPlace', 'ГОР. КИРОВ'),
    ],
  });

  const saved = await facts.saved();
  expect(saved.values).toMatchObject({
    lastName: 'ИВАНОВ',
    firstName: 'ИВАН',
    birthPlace: 'ГОР. КИРОВ',
    middleName: null,
  });
  expect(result.discrepancyFields).toEqual(['middleName']);
  expect(
    markSelectedCandidates(saved)
      .filter(({ field, selected }) => field === 'lastName' && selected)
      .map(({ evidence }) => evidence[0]?.documentId),
  ).toEqual([otherDocumentId, documentId]);
});

test('property cells can use separate citations from one source', async () => {
  const row = {
    description: 'квартира',
    identifier: '48:08:0000000:9000001',
    address: 'ул. Макетная, д. 02',
    area: '42,8',
    ownership: 'общая долевая собственность, доля 1/2',
  };
  const evidence = [
    'Вид объекта недвижимости: квартира. Кадастровый номер: 48:08:0000000:9000001.',
    'Адрес: ул. Макетная, д. 02.',
    'Площадь: 42,8 кв. м. Вид права: общая долевая собственность, доля 1/2.',
  ].map((quote) => ({ documentId, imagePath: null, quote }));
  const accept = async (candidate: Candidate, sourceText?: string) => {
    const facts = runFacts();
    await facts.accept({
      fields: ['realEstate'],
      confirmed: false,
      candidates: [candidate],
      ...(sourceText && { sourceTexts: [{ documentId, text: sourceText }] }),
    });
    return (await facts.saved()).values.realEstate;
  };
  const candidate: Candidate = { field: 'realEstate', value: [row], evidence };
  expect(await accept(candidate)).toEqual([row]);
  expect(
    await accept({
      ...candidate,
      evidence: evidence.map((entry, index) =>
        index === 1 ? { ...entry, documentId: otherDocumentId } : entry,
      ),
    }),
  ).toBeNull();
  for (const invalid of [
    { area: '42' },
    { ownership: 'единоличная собственность' },
    { identifier: '48:08:0000000:9000002' },
  ]) {
    expect(
      await accept({ ...candidate, value: [{ ...row, ...invalid }] }),
    ).toBeNull();
  }
  expect(
    await accept({
      ...candidate,
      value: [{ ...row, area: '62,8' }],
      evidence: [
        ...evidence,
        {
          documentId,
          imagePath: null,
          quote:
            'Кадастровый номер 48:08:0000000:9000002. Адрес: ул. Тестовая, д. 8. Площадь: 62,8 кв. м.',
        },
      ],
    }),
  ).toBeNull();
  expect(
    await accept(
      {
        ...candidate,
        value: [{ ...row, area: '62,8' }],
        evidence: [
          ...evidence,
          { documentId, imagePath: null, quote: 'Площадь: 62,8 кв. м.' },
        ],
      },
      [
        ...evidence.map(({ quote }) => quote),
        'Кадастровый номер 48:08:0000000:9000002. Площадь: 62,8 кв. м.',
      ].join('\n'),
    ),
  ).toBeNull();
});

test.each([
  ['businessDebts', 'Предпринимательские обязательства отсутствуют.'],
  ['businessReceivables', 'Предпринимательских должников нет.'],
  [
    'businessPayments',
    'Обязательных платежей по предпринимательской деятельности нет.',
  ],
  ['businessRefunds', 'Предпринимательских платежей к возврату нет.'],
] as const)(
  '%s is empty only when the source supports its absence',
  async (field, directAbsence) => {
    const accept = async (quotes: string[], text = quotes.join('\n')) => {
      const facts = runFacts();
      await facts.accept({
        fields: [field],
        confirmed: false,
        sourceTexts: [{ documentId, text }],
        candidates: [
          {
            field,
            value: [],
            evidence: quotes.map((quote) => ({
              documentId,
              imagePath: null,
              quote,
            })),
          },
        ],
      });
      return (await facts.saved()).values[field];
    };
    expect(
      await accept([
        'Предпринимательской деятельностью не занимался, статуса ИП не имел.',
      ]),
    ).toEqual([]);
    expect(await accept([directAbsence])).toEqual([]);
    expect(
      await accept(['Предпринимательской деятельностью не занималась.']),
    ).toBeNull();
    expect(await accept(['Работаю как ИП.'])).toBeNull();
    expect(
      await accept(['Должник: Примеров Матвей Лабораториевич.']),
    ).toBeNull();
    expect(await accept(['Статуса ИП не имел.'])).toBeNull();
    expect(
      await accept(
        [directAbsence.slice(0, -1)],
        directAbsence.slice(0, -1) + ', кроме одной записи.',
      ),
    ).toBeNull();
    expect(
      await accept(
        [directAbsence.slice(0, -1)],
        directAbsence.slice(0, -1) + '\nкроме одной записи.',
      ),
    ).toBeNull();
    expect(
      await accept(
        ['Предпринимательской деятельностью не занимался, статуса ИП не имел.'],
        'В 2026 году предпринимательской деятельностью не занимался, статуса ИП не имел. Долг за 2025 год сохраняется.',
      ),
    ).toBeNull();
  },
);

test('a later passport updates equivalent automatic spelling while preserving lawyer choices', async () => {
  const initial = emptyFacts();
  initial.values.lastName = 'Иванов';
  initial.values.firstName = 'Иван';
  initial.values.middleName = 'Иванович';
  initial.manual = ['firstName'];
  initial.confirmed = ['middleName'];
  const facts = runFacts(initial);
  const result = await facts.accept({
    fields: ['lastName', 'firstName', 'middleName'],
    confirmed: false,
    preserveExisting: true,
    passportIds: new Set([documentId]),
    candidates: [
      textCandidate('lastName', 'ИВАНОВ'),
      textCandidate('firstName', 'ИВАН'),
      textCandidate('middleName', 'ИВАНОВИЧ'),
    ],
  });
  expect((await facts.saved()).values).toMatchObject({
    lastName: 'ИВАНОВ',
    firstName: 'Иван',
    middleName: 'Иванович',
  });
  expect(result.discrepancyFields).toEqual([]);
});

test('citizenship requires a passport citation and keeps other proposals for review', async () => {
  const inferred: Candidate = {
    ...textCandidate('citizenship', 'Российская Федерация'),
    origin: 'inference',
    explanation: 'Место рождения в России',
  };
  const excerpt = {
    documentId,
    imagePath: null,
    quote: 'Паспорт гражданина Российской Федерации',
  };
  const passport: Candidate = {
    field: 'citizenship',
    value: 'Российская Федерация',
    evidence: [excerpt],
    origin: 'document',
  };
  const incidental: Candidate = {
    ...passport,
    evidence: [{ ...excerpt, quote: 'Гражданство: Российская Федерация' }],
  };
  const accept = async (candidate: Candidate) => {
    const facts = runFacts();
    await facts.accept({
      fields: ['citizenship'],
      confirmed: false,
      candidates: [candidate],
    });
    return facts.saved();
  };
  for (const candidate of [incidental, inferred]) {
    const saved = await accept(candidate);
    expect(saved.values.citizenship).toBeNull();
    expect(saved.candidates).toEqual([candidate]);
  }
  const saved = await accept(passport);
  expect(saved.values.citizenship).toBe('Российская Федерация');
  expect(markSelectedCandidates(saved)).toEqual([
    { ...passport, selected: true },
  ]);
});

test('bank debt accepts only a proposed contract type supported by its citations', async () => {
  const base = {
    name: 'ООО МКК «Синтетический Кредит»',
    contractNumber: 'A-42',
    contractDate: '2025-01-03',
    amount: '720.50',
    amountDate: '2026-11-09',
    debtStatus: 'Действует',
  };
  for (const [title, expected, adjacent = ''] of [
    ['Кредитный договор', 'Кредит'],
    ['Договор по кредитной карте', 'Кредитная карта'],
    ['Договор займа', 'Заём'],
    ['Договор', 'Кредитная карта', '\nВид договора: кредитная карта'],
    ['Договор', undefined],
    [
      'Договор',
      undefined,
      '\nДоговор по кредитной карте № B-73 от 03.01.2025\nОбщая задолженность: 150,00 руб.',
    ],
    ['Договор', undefined, '; Договор по кредитной карте № B-73 от 03.01.2025'],
    [
      'Договор',
      undefined,
      ' Договор № B-73 от 03.01.2025\nВид договора: кредитная карта',
    ],
  ] as const) {
    const facts = runFacts();
    const result = await facts.accept({
      fields: ['debts'],
      confirmed: false,
      candidates: [
        {
          field: 'debts',
          value: [{ ...base, ...(expected && { type: expected }) }],
          evidence: [
            {
              documentId,
              imagePath: null,
              quote: `${base.name}
По состоянию на 09.11.2026
${title} № A-42 от 03.01.2025${adjacent}
Общая задолженность по договору № A-42: 720,50 руб.`,
            },
          ],
        },
      ],
    });
    const debt = (await facts.saved()).values.debts;
    expect(debt).toBeArrayOfSize(1);
    if (!Array.isArray(debt)) throw new Error('Expected a saved obligation');
    expect(debt[0]?.amount).toBe('720.50');
    expect(debt[0]?.type).toBe(expected);
    expect(result.discrepancyFields).toEqual(expected ? [] : ['debts']);
  }
});

test('accepts context additions without overriding or duplicating contradictory document candidates', async () => {
  const facts = runFacts();
  const first = textCandidate('personName', 'Анна');
  const second = textCandidate('personName', 'Ирина');
  const contextOnly = {
    ...textCandidate('documentNumber', '42'),
    origin: 'context' as const,
  };
  const result = await facts.accept({
    fields: ['personName', 'documentNumber'],
    confirmed: false,
    candidates: [first, second],
    contextCandidates: [{ ...first, origin: 'context' }, contextOnly],
  });

  const saved = await facts.saved();
  expect(result).toMatchObject({
    contextAccepted: true,
    missingFields: ['personName'],
    discrepancyFields: ['personName'],
  });
  expect(
    result.proposalOutcomes.map(({ stage, status }) => [stage, status]),
  ).toEqual([
    ['extraction', 'review'],
    ['extraction', 'review'],
    ['reconciliation', 'review'],
    ['reconciliation', 'applied'],
  ]);
  expect(saved.values.personName).toBeNull();
  expect(saved.values.documentNumber).toBe('42');
  expect(saved.candidates).toEqual([first, second, contextOnly]);
});

test('one calendar day from different sources fills one fact and preserves both original citations', async () => {
  const facts = runFacts();
  const candidates = [
    textCandidate('birthDate', '30.08.2003'),
    textCandidate('birthDate', '30 августа 2003 года', otherDocumentId),
  ];
  const result = await facts.accept({
    fields: ['birthDate'],
    confirmed: false,
    candidates,
  });
  const saved = await facts.saved();
  expect(result.discrepancyFields).toEqual([]);
  expect(result.missingFields).toEqual([]);
  expect(saved.values.birthDate).toBe('30.08.2003');
  expect(markSelectedCandidates(saved)).toEqual(
    candidates.map((candidate) => ({ ...candidate, selected: true })),
  );
});

test('money keeps original citations for equivalent words and numbers and detects one kopeck', async () => {
  const numeric = textCandidate('debtTotal', '1 234,05', documentId);
  const written = textCandidate(
    'debtTotal',
    'одна тысяча двести тридцать четыре рубля пять копеек',
    otherDocumentId,
  );
  const facts = runFacts();
  const inputs = {
    fields: ['debtTotal'] as const,
    confirmed: false,
    preserveExisting: true,
  };
  const equivalent = await facts.accept({
    ...inputs,
    candidates: [numeric, written],
  });
  expect(equivalent.discrepancyFields).toEqual([]);
  expect((await facts.saved()).values.debtTotal).toBe('1234.05');
  expect((await facts.saved()).candidates).toEqual([numeric, written]);
  const different = await facts.accept({
    ...inputs,
    candidates: [textCandidate('debtTotal', '1234.06')],
  });
  expect(different.discrepancyFields).toEqual(['debtTotal']);
  expect((await facts.saved()).values.debtTotal).toBe('1234.05');
});

test('a new group keeps its saved facts, adds support and fills unconfirmed gaps', async () => {
  const initial = emptyFacts();
  const oldName = textCandidate('personName', 'Анна');
  const number = textCandidate('documentNumber', '42');
  const corroboratingNumber = textCandidate(
    'documentNumber',
    '42',
    otherDocumentId,
  );
  initial.values.personName = 'Анна';
  initial.values.documentNumber = '42';
  initial.values.observations = 'Решение юриста';
  initial.manual = ['observations'];
  initial.confirmed = ['documentNumber', 'city'];
  initial.candidates = [oldName, number];
  const facts = runFacts(initial);
  const anotherName = textCandidate('personName', 'Ирина', otherDocumentId);
  const city = textCandidate('city', 'Тула', otherDocumentId);
  const result = await facts.accept({
    fields: ['personName', 'documentNumber', 'city', 'observations'],
    confirmed: false,
    preserveExisting: true,
    candidates: [anotherName, corroboratingNumber, city],
    contextCandidates: [],
  });
  const saved = await facts.saved();
  expect(result.discrepancyFields).toEqual(['personName']);
  expect(saved.values).toMatchObject({
    personName: 'Анна',
    documentNumber: '42',
    city: 'Тула',
    observations: 'Решение юриста',
  });
  expect(saved.confirmed).toEqual(['documentNumber']);
  expect(saved.candidates).toEqual([
    anotherName,
    corroboratingNumber,
    city,
    oldName,
    number,
  ]);
});

test('overflowing additions leave the previously saved sources and value intact', async () => {
  const initial = emptyFacts();
  initial.values.personName = 'Анна';
  initial.candidates = Array.from({ length: 500 }, (_, index) => ({
    field: 'personName',
    value: 'Анна',
    evidence: [
      { documentId, imagePath: null, quote: `Анна, пункт ${String(index)}` },
    ],
  }));
  const facts = runFacts(initial);
  const addition = textCandidate('personName', 'Ирина', otherDocumentId);
  const result = await facts.accept({
    fields: ['personName'],
    confirmed: false,
    preserveExisting: true,
    candidates: [addition],
    contextCandidates: [],
  });
  expect(result.contextAccepted).toBe(false);
  expect(result.proposalOutcomes).toEqual([
    { candidate: addition, stage: 'extraction', status: 'rejected' },
  ]);
  const saved = await facts.saved();
  expect(saved.values.personName).toBe('Анна');
  expect(saved.candidates).toEqual(initial.candidates);
});

test('a different calendar day is a discrepancy, an impossible date remains an unfilled proposal', async () => {
  const facts = runFacts();
  const invalid = textCandidate('passportIssuedAt', '29 февраля 2023 года');
  const result = await facts.accept({
    fields: ['birthDate', 'passportIssuedAt'],
    confirmed: false,
    candidates: [
      textCandidate('birthDate', '30.08.2003'),
      textCandidate('birthDate', '31 августа 2003 года', otherDocumentId),
      invalid,
    ],
  });
  const saved = await facts.saved();
  expect(result.discrepancyFields).toEqual(['birthDate']);
  expect(saved.values.birthDate).toBeNull();
  expect(saved.values.passportIssuedAt).toBeNull();
  expect(markSelectedCandidates(saved)).toContainEqual({
    ...invalid,
    selected: false,
  });
});

test('the command merges different obligations and returns a discrepancy for incompatible cells', async () => {
  const first = tableCandidate('Договор А', '100.00');
  const second = tableCandidate('Договор Б', '200.00');
  const facts = runFacts();
  const merged = await facts.accept({
    fields: ['debts'],
    confirmed: false,
    candidates: [first, second],
  });
  const saved = await facts.saved();
  expect(merged.missingFields).toEqual([]);
  expect(merged.discrepancyFields).toEqual([]);
  expect(saved.values.debts).toEqual([
    { name: 'Тестовый банк', basis: 'Договор А', amount: '100.00' },
    { name: 'Тестовый банк', basis: 'Договор Б', amount: '200.00' },
  ]);
  expect(markSelectedCandidates(saved).map(({ selected }) => selected)).toEqual(
    [true, true],
  );

  const conflict = await facts.accept({
    fields: ['debts'],
    confirmed: false,
    candidates: [tableCandidate('Договор А', '999.00')],
  });
  const unresolved = await facts.saved();
  expect(conflict.missingFields).toEqual(['debts']);
  expect(conflict.discrepancyFields).toEqual(['debts']);
  expect(unresolved.values.debts).toBeNull();
  expect(unresolved.candidates).toHaveLength(3);
  expect(
    markSelectedCandidates(unresolved).map(({ selected }) => selected),
  ).toEqual([false, false, false]);

  const cleared = runFacts({
    ...saved,
    values: { ...saved.values, debts: [] },
    manual: ['debts'],
  });
  await cleared.accept({
    fields: ['debts'],
    confirmed: false,
    candidates: [tableCandidate('Договор В', '300.00')],
  });
  expect((await cleared.saved()).values.debts).toEqual([]);
});

test('keeps inferred scalar and table values for review while saving direct evidence automatically', async () => {
  const facts = runFacts();
  const quoted = textCandidate('personName', 'Анна');
  const proposals = [
    {
      ...textCandidate('documentDate', 'Дата регистрации: 22.08.2026'),
      origin: 'inference',
      value: '2026-08-21',
      explanation: 'Документ подписан за день до регистрации.',
    },
    {
      ...tableCandidate('Договор А', '300.00'),
      origin: 'inference',
      explanation: 'Сложены платежи по одному договору.',
    },
  ] satisfies Candidate[];
  const result = await facts.accept({
    fields: ['personName', 'documentDate', 'debts'],
    confirmed: false,
    candidates: [quoted],
    contextCandidates: proposals,
  });

  const saved = await facts.saved();
  expect(result.missingFields).toEqual(['documentDate', 'debts']);
  expect(result.discrepancyFields).toEqual([]);
  expect(result.proposalOutcomes.map(({ status }) => status)).toEqual([
    'applied',
    'review',
    'review',
  ]);
  expect(saved.values.personName).toBe('Анна');
  expect(saved.values.documentDate).toBeNull();
  expect(saved.values.debts).toBeNull();
  expect(saved.candidates).toEqual([quoted, ...proposals]);
  expect(markSelectedCandidates(saved).map(({ selected }) => selected)).toEqual(
    [true, false, false],
  );
});

test('only a partial stage keeps an unproposed field from the run', async () => {
  const initial = emptyFacts();
  initial.values.firstName = 'Мария';
  initial.values.documentNumber = '42';
  const fields = ['firstName', 'lastName', 'personName'] as const;
  const candidates = [textCandidate('personName', 'Анна')];
  const partial = runFacts(initial);
  expect(
    await partial.accept({ fields, confirmed: false, candidates }),
  ).toMatchObject({
    contextAccepted: false,
    missingFields: ['lastName'],
    discrepancyFields: [],
  });
  const saved = await partial.saved();
  expect(saved.values.firstName).toBe('Мария');
  expect(saved.values.personName).toBe('Анна');
  expect(saved.values.documentNumber).toBeNull();

  const complete = runFacts(initial);
  expect(
    await complete.accept({
      fields,
      confirmed: false,
      candidates,
      contextCandidates: [],
    }),
  ).toMatchObject({
    contextAccepted: true,
    missingFields: ['firstName', 'lastName'],
    discrepancyFields: [],
  });
  expect((await complete.saved()).values.firstName).toBeNull();
});

test('history credits the applied document proposal separately from matching proposals', async () => {
  const facts = runFacts();
  const document = textCandidate('personName', 'Анна');
  const result = await facts.accept({
    fields: ['personName'],
    confirmed: false,
    candidates: [document],
    contextCandidates: [
      { ...document, origin: 'context' },
      { ...document, origin: 'inference', explanation: 'Совпавший вывод.' },
    ],
  });
  expect((await facts.saved()).values.personName).toBe('Анна');
  expect(result.proposalOutcomes.map(({ status }) => status)).toEqual([
    'applied',
    'matched',
    'matched',
  ]);
  const repeated = await facts.accept({
    fields: ['personName'],
    confirmed: false,
    candidates: [document],
  });
  expect(repeated.proposalOutcomes[0]?.status).toBe('retained');
});

test.each(['previous', 'context'] as const)(
  'rejects overflowing %s proposals and saves the valid extraction',
  async (source) => {
    const initial = emptyFacts();
    initial.values.firstName = 'Мария';
    const optional = textCandidate('documentNumber', '42');
    if (source === 'previous') initial.candidates = [optional];
    const facts = runFacts(initial);
    const candidates = Array.from({ length: 500 }, (_, index) =>
      textCandidate('personName', String(index)),
    );
    const result = await facts.accept({
      fields: ['firstName', 'personName'],
      confirmed: false,
      candidates,
      contextCandidates: source === 'context' ? [optional] : [],
    });
    const saved = await facts.saved();
    expect(result).toMatchObject({
      contextAccepted: false,
      missingFields: ['personName'],
      discrepancyFields: ['personName'],
    });
    expect(saved.values.firstName).toBe('Мария');
    expect(saved.candidates).toEqual(candidates);
    expect(
      result.proposalOutcomes.filter(({ stage }) => stage === 'reconciliation'),
    ).toEqual(
      source === 'context'
        ? [{ candidate: optional, stage: 'reconciliation', status: 'rejected' }]
        : [],
    );
  },
);

test('confirmed work keeps saved values while accepting and reporting new candidates', async () => {
  const initial = emptyFacts();
  initial.values.personName = 'Мария';
  initial.confirmed = ['personName'];
  const facts = runFacts(initial);
  const proposed = textCandidate('personName', 'Анна');
  const result = await facts.accept({
    fields: ['personName'],
    confirmed: true,
    candidates: [proposed],
  });
  expect(result.discrepancyFields).toEqual(['personName']);
  const saved = await facts.saved();
  expect(saved.values.personName).toBe('Мария');
  expect(saved.candidates).toEqual([proposed]);
});

test('context preparation only reuses document candidates for unreadable sources of this run', () => {
  const raw = textCandidate('personName', 'Анна');
  const unreadable = textCandidate('lastName', 'Иванова', otherDocumentId);
  const foreign = textCandidate(
    'firstName',
    'Мария',
    '01900000-0000-7000-8000-000000000004',
  );
  expect(
    candidatesForContext(
      [raw],
      [
        textCandidate('firstName', 'Ирина'),
        unreadable,
        foreign,
        { ...unreadable, origin: 'context' },
      ],
      [documentId, otherDocumentId],
      [documentId],
    ),
  ).toEqual([raw, unreadable]);
});

test('accepts a later documented closure while keeping conflicting active balances for review', async () => {
  let evidenceNumber = 100;
  const makeDebt = (
    contractNumber: string,
    amount: string,
    amountDate: string,
    debtStatus: string,
    wording: string,
  ): Candidate => ({
    field: 'debts',
    value: [
      {
        name: 'АО Синтетический Банк',
        contractNumber,
        contractDate: '2025-01-03',
        ...(debtStatus === 'Действует' && { amount }),
        amountDate,
        debtStatus,
      },
    ],
    evidence: [
      {
        documentId:
          ref.workId.slice(0, -3) + String(evidenceNumber++).padStart(3, '0'),
        imagePath: null,
        quote:
          'АО Синтетический Банк\nДоговор № ' +
          contractNumber +
          ' от 03.01.2025\nПо состоянию на ' +
          amountDate +
          '\n' +
          wording,
      },
    ],
  });
  const first = makeDebt(
    'ACT-1',
    '100.05',
    '08.11.2026',
    'Действует',
    'Полная задолженность 100,05 руб.',
  );
  const repeat = makeDebt(
    'ACT-1',
    '100.05',
    '09.11.2026',
    'Действует',
    'Общая задолженность 100,05 руб.',
  );
  const second = makeDebt(
    'ACT-2',
    '200.06',
    '09.11.2026',
    'Действует',
    'Общая задолженность 200,06 руб.',
  );
  const changed = makeDebt(
    'ACT-1',
    '110.07',
    '10.11.2026',
    'Действует',
    'Полная задолженность 110,07 руб.',
  );
  const closing = makeDebt(
    'ACT-2',
    '0',
    '10.11.2026',
    'Закрыт',
    'Кредитный договор закрыт.',
  );
  const repayment = makeDebt(
    'ACT-2',
    '0',
    '10.11.2026',
    'Погашен',
    'Обязательства по кредитному договору исполнены в полном объеме.',
  );
  const turnover = makeDebt(
    'ACT-3',
    '9000.10',
    '09.11.2026',
    'Действует',
    'Оборот по счёту: 9000,10 руб.',
  );
  const facts = runFacts();
  const accept = (candidates: Candidate[], preserveExisting = false) =>
    facts.accept({
      fields: ['debts'],
      confirmed: false,
      candidates,
      preserveExisting,
    });

  await accept([first, repeat, second, turnover]);
  let saved = await facts.saved();
  expect(saved.values.debts).toEqual([
    expect.objectContaining({ contractNumber: 'ACT-1', amount: '100.05' }),
    expect.objectContaining({ contractNumber: 'ACT-2', amount: '200.06' }),
  ]);
  expect(saved.candidates).toHaveLength(4);
  const beforeClosure = saved;

  const negatedRepayment = makeDebt(
    'ACT-2',
    '0',
    '10.11.2026',
    'Погашен',
    'Кредит не полностью погашен.',
  );
  const incompleteObligations = makeDebt(
    'ACT-2',
    '0',
    '10.11.2026',
    'Погашен',
    'Обязательства по кредитному договору не исполнены в полном объёме.',
  );
  const negated = runFacts(beforeClosure);
  await negated.accept({
    fields: ['debts'],
    confirmed: false,
    preserveExisting: true,
    candidates: [negatedRepayment, incompleteObligations],
  });
  const afterNegation = await negated.saved();
  expect(afterNegation.candidates).toContainEqual(negatedRepayment);
  expect(afterNegation.candidates).toContainEqual(incompleteObligations);
  expect(
    obligationAmounts(afterNegation.values.debts, null).debts,
  ).toMatchObject([
    { contractNumber: 'ACT-1', amount: '100,05' },
    { contractNumber: 'ACT-2', amount: '200,06' },
  ]);

  const repaid = runFacts(beforeClosure);
  await repaid.accept({
    fields: ['debts'],
    confirmed: false,
    preserveExisting: true,
    candidates: [repayment],
  });
  const afterRepayment = await repaid.saved();
  expect(afterRepayment.values.debts).toMatchObject([
    { contractNumber: 'ACT-1', amount: '100.05' },
    { contractNumber: 'ACT-2', debtStatus: 'Погашен' },
  ]);
  expect(
    obligationAmounts(afterRepayment.values.debts, null).debts,
  ).toMatchObject([{ contractNumber: 'ACT-1', amount: '100,05' }]);

  const result = await accept([changed, closing], true);
  saved = await facts.saved();
  expect(saved.values.debts).toEqual([
    expect.objectContaining({ contractNumber: 'ACT-1', amount: '100.05' }),
    expect.objectContaining({
      contractNumber: 'ACT-2',
      debtStatus: 'Закрыт',
    }),
  ]);
  expect(saved.candidates).toHaveLength(6);
  expect(result.discrepancyFields).toContain('debts');
  expect(obligationAmounts(saved.values.debts, null).debts).toMatchObject([
    { contractNumber: 'ACT-1', amount: '100,05' },
  ]);

  for (const review of ['manual', 'confirmed'] as const) {
    const reviewed = runFacts({ ...beforeClosure, [review]: ['debts'] });
    await reviewed.accept({
      fields: ['debts'],
      confirmed: false,
      preserveExisting: true,
      candidates: [closing],
    });
    expect((await reviewed.saved()).values.debts).toEqual(
      beforeClosure.values.debts,
    );
  }
});

test('keeps the latest documented amount of a new debt when reconciliation has no output', async () => {
  const debt = (
    contractNumber: string,
    amount: string,
    date: string,
    source: string,
  ): Candidate => ({
    field: 'debts',
    value: [
      {
        name: 'АО Синтетический Банк',
        contractNumber,
        contractDate: '03.01.2025',
        amount,
        amountDate: date,
        debtStatus: 'Действует',
      },
    ],
    evidence: [
      {
        documentId: source,
        imagePath: null,
        quote: `АО Синтетический Банк\nДоговор № ${contractNumber} от 03.01.2025\nПо состоянию на ${date}\nПолная задолженность ${amount.replace('.', ',')} руб.`,
      },
    ],
  });
  const earlier = debt('A-51', '151000.00', '28.10.2026', documentId);
  const earlierProof = earlier.evidence[0];
  if (!earlierProof) throw new Error('Expected a dated certificate');
  earlierProof.quote = earlierProof.quote.replace(
    'Договор №',
    'Кредитный договор №',
  );
  const latest = debt('A-51', '145006.47', '18.11.2026', otherDocumentId);
  const second = debt('A-52', '11500.25', '18.11.2026', otherDocumentId);
  const third = debt('A-62', '15993.53', '20.11.2026', documentId);
  const candidates = [earlier, latest, second, third];
  const facts = runFacts();
  const result = await facts.accept({
    fields: ['debts'],
    confirmed: false,
    preserveExisting: true,
    candidates,
  });
  const saved = await facts.saved();
  expect(result.contextAccepted).toBe(false);
  for (const candidate of candidates)
    expect(saved.candidates).toContainEqual(candidate);
  expect(obligationAmounts(saved.values.debts, null).debts).toMatchObject([
    { contractNumber: 'A-51', amount: '145006,47' },
    { contractNumber: 'A-52', amount: '11500,25' },
    { contractNumber: 'A-62', amount: '15993,53' },
  ]);

  const ambiguous = runFacts();
  const conflict = await ambiguous.accept({
    fields: ['debts'],
    confirmed: false,
    candidates: [
      earlier,
      latest,
      debt('A-51', '160000.00', '18.11.2026', documentId),
    ],
  });
  expect(conflict.discrepancyFields).toContain('debts');
  expect((await ambiguous.saved()).values.debts).toBeNull();

  const crossed = debt('A-51', '151000.00', '22.11.2026', documentId);
  crossed.evidence = [
    {
      documentId,
      imagePath: null,
      quote:
        earlierProof.quote +
        '\nДоговор № B-73 от 03.01.2025\nПо состоянию на 22.11.2026\nПолная задолженность 500,00 руб.',
    },
  ];
  const crossedFacts = runFacts();
  const crossedResult = await crossedFacts.accept({
    fields: ['debts'],
    confirmed: false,
    candidates: [crossed, latest],
  });
  expect(crossedResult.discrepancyFields).toContain('debts');
  expect((await crossedFacts.saved()).values.debts).toBeNull();
});

test('a newer certificate blocks an old balance even when its extraction produced no usable row', async () => {
  const contract = {
    name: 'АО Синтетический Банк',
    contractNumber: 'QA-VT-51',
    contractDate: '23.05.2024',
    debtStatus: 'Действует',
  };
  const amountEvidence = (date: string, amount: string) =>
    [
      'Справка о размере задолженности',
      'АО Синтетический Банк',
      `Расчёт по состоянию на ${date}.`,
      'Кредитный договор № QA-VT-51 от 23.05.2024.',
      `Полная задолженность по договору № QA-VT-51 — ${amount.replace('.', ',')} руб.`,
    ].join('\n');
  const earlier: Candidate = {
    field: 'debts',
    value: [{ ...contract, amount: '151000.00', amountDate: '28.10.2026' }],
    evidence: [
      {
        documentId,
        imagePath: null,
        quote: amountEvidence('28.10.2026', '151000.00'),
      },
    ],
  };
  const currentText =
    amountEvidence('18.11.2026', '145006.47') +
    '\nКредитный договор № QA-VT-52 от 16.06.2024.\nПолная задолженность 11 500,25 руб.';
  const current: Candidate = {
    ...earlier,
    value: [{ ...contract, amount: '145006.47', amountDate: '18.11.2026' }],
    evidence: [
      { documentId: otherDocumentId, imagePath: null, quote: currentText },
    ],
  };
  const previousSource = { documentId, text: earlier.evidence[0]?.quote ?? '' };
  const input = {
    fields: ['debts'] as const,
    confirmed: false,
    preserveExisting: true,
    sourceTexts: [
      { documentId: otherDocumentId, text: currentText },
      previousSource,
    ],
  };
  const facts = runFacts();
  const held = await facts.accept({ ...input, candidates: [earlier] });
  expect((await facts.saved()).values.debts).toBeNull();
  expect(held.missingFields).toContain('debts');
  expect(held.proposalOutcomes).toMatchObject([
    { candidate: earlier, status: 'review' },
  ]);

  const initial = emptyFacts();
  initial.values.debts = earlier.value;
  const existing = runFacts(initial);
  await existing.accept({ ...input, candidates: [] });
  expect((await existing.saved()).values.debts).toBeNull();

  const rejected = runFacts(initial);
  await rejected.accept({
    ...input,
    candidates: [
      earlier,
      {
        ...current,
        value: [{ ...contract, amount: '999.99', amountDate: '18.11.2026' }],
      },
    ],
  });
  expect((await rejected.saved()).values.debts).toBeNull();

  const withLatest = runFacts(initial);
  await withLatest.accept({ ...input, candidates: [earlier, current] });
  expect((await withLatest.saved()).values.debts).toEqual(current.value);

  const unrelated = runFacts();
  await unrelated.accept({
    ...input,
    candidates: [earlier],
    sourceTexts: [
      {
        documentId: otherDocumentId,
        text: currentText.replaceAll('QA-VT-51', 'QA-VT-50'),
      },
      previousSource,
    ],
  });
  expect((await unrelated.saved()).values.debts).toEqual(earlier.value);

  const mixedDates = runFacts();
  await mixedDates.accept({
    ...input,
    candidates: [earlier],
    sourceTexts: [
      {
        documentId,
        text:
          amountEvidence('28.10.2026', '151000.00') +
          '\nДоговор № QA-VT-52 от 16.06.2024, по состоянию на 18.11.2026.\nПолная задолженность 11 500,25 руб.',
      },
    ],
  });
  expect((await mixedDates.saved()).values.debts).toEqual(earlier.value);

  const blocks = [
    'Справка о размере задолженности',
    contract.name,
    'Кредитный договор № QA-VT-51 от 23.05.2024.',
    'Расчёт по состоянию на 18.11.2026.',
    'Полная задолженность 145 006,47 руб.',
    'Кредитный договор № QA-VT-52 от 16.06.2024.',
    'Расчёт по состоянию на 20.11.2026.',
    'Полная задолженность 11 500,25 руб.',
  ];
  const crossed = runFacts();
  await crossed.accept({
    ...input,
    sourceTexts: [
      { documentId: otherDocumentId, text: blocks.join('\n') },
      previousSource,
    ],
    candidates: [
      earlier,
      {
        ...current,
        value: [{ ...contract, amount: '11500.25', amountDate: '18.11.2026' }],
        evidence: [
          {
            documentId: otherDocumentId,
            imagePath: null,
            quote: blocks.slice(0, 4).join('\n'),
          },
          {
            documentId: otherDocumentId,
            imagePath: null,
            quote: 'Полная задолженность 11 500,25 руб.',
          },
        ],
      },
    ],
  });
  expect((await crossed.saved()).values.debts).toBeNull();

  const noNumberSign = runFacts();
  const missingFirstAmount = blocks
    .filter((line) => !line.includes('145 006,47'))
    .join('\n')
    .replaceAll('№ ', '');
  await noNumberSign.accept({
    ...input,
    sourceTexts: [
      { documentId: otherDocumentId, text: missingFirstAmount },
      previousSource,
    ],
    candidates: [
      earlier,
      {
        ...current,
        value: [{ ...contract, amount: '11500.25', amountDate: '18.11.2026' }],
        evidence: [
          {
            documentId: otherDocumentId,
            imagePath: null,
            quote: missingFirstAmount,
          },
        ],
      },
    ],
  });
  expect((await noNumberSign.saved()).values.debts).toBeNull();
});

test('accepts a credit certificate with adjacent contract number and date fields from one evidence block', async () => {
  const row = {
    name: 'АО Синтетический Банк',
    contractNumber: 'A-42',
    contractDate: '2025-01-03',
    amount: '720.50',
    amountDate: '2026-11-09',
    debtStatus: 'Действует',
  };
  const numberLine = 'Номер договора: A-42';
  const dateLine = 'Дата заключения договора: 03.01.2025';
  const sharedLines =
    'АО Синтетический Банк\nПо состоянию на 09.11.2026\nОбщая задолженность: 720,50 руб.';
  const accept = async (quotes: string[]) => {
    const facts = runFacts();
    await facts.accept({
      fields: ['debts'],
      confirmed: false,
      candidates: [
        {
          field: 'debts',
          value: [row],
          evidence: quotes.map((quote) => ({
            documentId,
            imagePath: null,
            quote,
          })),
        },
      ],
    });
    return (await facts.saved()).values.debts;
  };

  expect(await accept([sharedLines + '\n' + numberLine, dateLine])).toBeNull();
  expect(
    await accept([
      [sharedLines, numberLine, 'Номер договора: A-43', dateLine].join('\n'),
    ]),
  ).toBeNull();
  expect(
    await accept([[sharedLines, numberLine, dateLine].join('\n')]),
  ).toEqual([row]);
});
