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
    accept: (input: Omit<AcceptRunCandidatesInput, keyof typeof ref>) =>
      facts.in(tx).commands.acceptRunCandidates({ ...ref, ...input }),
    saved: () => facts.queries.forAnalysis(ref),
  };
}

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
        amount,
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
