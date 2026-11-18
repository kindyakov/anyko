import { expect, test } from 'bun:test';

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
  expect(result).toEqual({
    contextAccepted: true,
    missingFields: ['personName'],
    discrepancyFields: ['personName'],
  });
  expect(saved.values.personName).toBeNull();
  expect(saved.values.documentNumber).toBe('42');
  expect(saved.candidates).toEqual([first, second, contextOnly]);
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

test('only a partial stage keeps an unproposed field from the run', async () => {
  const initial = emptyFacts();
  initial.values.firstName = 'Мария';
  initial.values.documentNumber = '42';
  const fields = ['firstName', 'lastName', 'personName'] as const;
  const candidates = [textCandidate('personName', 'Анна')];
  const partial = runFacts(initial);
  expect(
    await partial.accept({ fields, confirmed: false, candidates }),
  ).toEqual({
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
  ).toEqual({
    contextAccepted: true,
    missingFields: ['firstName', 'lastName'],
    discrepancyFields: [],
  });
  expect((await complete.saved()).values.firstName).toBeNull();
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
    expect(result).toEqual({
      contextAccepted: false,
      missingFields: ['personName'],
      discrepancyFields: ['personName'],
    });
    expect(saved.values.firstName).toBe('Мария');
    expect(saved.candidates).toEqual(candidates);
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
