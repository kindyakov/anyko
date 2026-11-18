import { expect, test } from 'bun:test';

import type { WorkFacts } from './schemas';

import {
  confirmFacts,
  editFacts,
  emptyFacts,
  type FactEvidence,
  findFactConflicts,
  mergeCandidates,
  refreshFactEvidence,
} from './index';

const candidate = (value: string): WorkFacts['candidates'][number] => ({
  field: 'personName',
  value,
  evidence: [
    { documentId: crypto.randomUUID(), imagePath: null, quote: value },
  ],
});
test('refresh preserves a value supported by another source and a manual value without that evidence', () => {
  const removed = candidate('Анна');
  const retained = candidate('Анна');
  const initial = confirmFacts(
    mergeCandidates(emptyFacts(), [removed, retained], false),
  );
  const refresh = (entry: FactEvidence) =>
    entry.documentId === removed.evidence[0]?.documentId ? null : entry;
  const supported = refreshFactEvidence(initial, refresh);
  expect(supported.needsReview).toEqual([]);
  expect(supported.confirmed).toContain('personName');
  expect(supported.candidates).toEqual([retained]);
  const manual = editFacts(initial, { ...initial.values, personName: 'Ирина' });
  expect(refreshFactEvidence(manual, () => null).needsReview).toEqual([]);
});

test('automatic extraction keeps a value whose evidence was lost until explicit confirmation', () => {
  const initial = confirmFacts(
    mergeCandidates(emptyFacts(), [candidate('Анна')], false),
  );
  const stale = refreshFactEvidence(initial, () => null);
  expect(stale.needsReview).toEqual(['personName']);
  const analyzed = mergeCandidates(stale, [candidate('Ирина')], false);
  expect(analyzed.values.personName).toBe('Анна');
  expect(analyzed.needsReview).toEqual(['personName']);
  expect(confirmFacts(analyzed).needsReview).toEqual([]);
});

test('an accepted date loses confirmation when its image proof disappears', () => {
  const draft = emptyFacts();
  const initial = confirmFacts(
    editFacts(
      {
        ...draft,
        candidates: [
          {
            field: 'documentDate',
            value: '2020-06-01',
            evidence: [
              {
                documentId: crypto.randomUUID(),
                imagePath: 'images/date.png',
                quote: '01.06.2020',
              },
            ],
          },
        ],
      },
      { ...draft.values, documentDate: '2020-06-01' },
    ),
  );
  const next = refreshFactEvidence(initial, () => null);
  expect(next.values.documentDate).toBe('2020-06-01');
  expect(next.confirmed).not.toContain('documentDate');
  expect(next.needsReview).toEqual(['documentDate']);
});

test('a surviving quote without the accepted amount does not keep its confirmation', () => {
  const documentId = crypto.randomUUID();
  const initial = confirmFacts(
    mergeCandidates(
      emptyFacts(),
      [
        {
          field: 'debtTotal',
          value: '100',
          evidence: [
            { documentId, imagePath: null, quote: 'Итого: 100' },
            { documentId, imagePath: null, quote: 'Сумма долга' },
          ],
        },
      ],
      false,
    ),
  );
  expect(initial.values.debtTotal).toBe('100');
  const next = refreshFactEvidence(initial, (entry) =>
    entry.quote === 'Сумма долга' ? entry : null,
  );
  expect(next.values.debtTotal).toBe('100');
  expect(next.candidates[0]?.evidence[0]?.quote).toBe('Сумма долга');
  expect(next.confirmed).not.toContain('debtTotal');
  expect(next.needsReview).toEqual(['debtTotal']);
});

test('a confirmed table row without a complete identity still loses review support when its quote disappears', () => {
  const initial = confirmFacts(
    mergeCandidates(
      emptyFacts(),
      [
        {
          field: 'realEstate',
          value: [{ description: 'Гараж', address: null }],
          evidence: [
            {
              documentId: crypto.randomUUID(),
              imagePath: null,
              quote: 'Гараж',
            },
          ],
        },
      ],
      false,
    ),
  );
  const next = refreshFactEvidence(initial, () => null);
  expect(next.values.realEstate).toEqual([{ description: 'Гараж' }]);
  expect(next.confirmed).not.toContain('realEstate');
  expect(next.needsReview).toEqual(['realEstate']);
});
test('contradictory sources remain visible and do not silently choose a value', () => {
  const result = mergeCandidates(
    emptyFacts(),
    [candidate('Анна'), candidate('Ирина')],
    false,
  );
  expect(result.values.personName).toBeNull();
  expect(result.candidates.map((item) => item.value)).toEqual([
    'Анна',
    'Ирина',
  ]);
});
test('manual values survive new extraction, including an intentionally cleared field', () => {
  const initial = mergeCandidates(emptyFacts(), [candidate('Анна')], false);
  const manual = editFacts(initial, { ...initial.values, personName: null });
  expect(
    mergeCandidates(manual, [candidate('Ирина')], false).values.personName,
  ).toBeNull();
});
test('confirmed values survive conflicting extraction while new candidates remain reviewable', () => {
  const initial = mergeCandidates(emptyFacts(), [candidate('Анна')], false);
  const result = mergeCandidates(initial, [candidate('Ирина')], true);
  expect(result.values.personName).toBe('Анна');
  expect(result.candidates[0]?.value).toBe('Ирина');
});

test('table candidates merge distinct obligations but retain conflicting amounts for review', () => {
  const table = (
    basis: string,
    amount: string,
  ): WorkFacts['candidates'][number] => ({
    field: 'debts',
    value: [{ name: 'Тестовый банк', basis, amount }],
    evidence: [
      {
        documentId: crypto.randomUUID(),
        imagePath: null,
        quote: `Тестовый банк · ${basis} · ${amount}`,
      },
    ],
  });
  const merged = mergeCandidates(
    emptyFacts(),
    [table('Договор А', '100.00'), table('Договор Б', '200.00')],
    false,
  );
  expect(merged.values.debts).toEqual([
    { name: 'Тестовый банк', basis: 'Договор А', amount: '100.00' },
    { name: 'Тестовый банк', basis: 'Договор Б', amount: '200.00' },
  ]);
  const conflict = mergeCandidates(
    emptyFacts(),
    [table('Договор А', '100.00'), table('Договор А', '999.00')],
    false,
  );
  expect(conflict.values.debts).toBeNull();
  expect(conflict.candidates).toHaveLength(2);
  const manual = editFacts(merged, { ...merged.values, debts: [] });
  expect(
    mergeCandidates(manual, [table('Договор В', '300.00')], false).values.debts,
  ).toEqual([]);
});

test('context status distinguishes complementary obligations from contradictory amounts', () => {
  const documentId = crypto.randomUUID();
  const evidence = (quote: string) => [{ documentId, imagePath: null, quote }];
  const first = {
    field: 'debts' as const,
    value: [{ name: 'Bank A', basis: 'Contract A', amount: '100' }],
    evidence: evidence('Bank A | Contract A | 100'),
  };
  const second = {
    field: 'debts' as const,
    value: [{ name: 'Bank B', basis: 'Contract B', amount: '200' }],
    evidence: evidence('Bank B | Contract B | 200'),
  };
  const combined = mergeCandidates(emptyFacts(), [first, second], false);
  expect(findFactConflicts(combined)).not.toContain('debts');
  const conflicting = mergeCandidates(
    emptyFacts(),
    [
      first,
      {
        ...first,
        value: [{ name: 'Bank A', basis: 'Contract A', amount: '300' }],
      },
    ],
    false,
  );
  expect(findFactConflicts(conflicting)).toContain('debts');
});

test('does not autofill an unsupported identifier, date or an amount from a different row', () => {
  const documentId = crypto.randomUUID();
  const evidence = (quote: string) => [{ documentId, imagePath: null, quote }];
  const result = mergeCandidates(
    emptyFacts(),
    [
      {
        field: 'inn',
        value: '123456789048',
        evidence: evidence('ИНН 123456789048'),
      },
      {
        field: 'birthDate',
        value: '2000-02-29',
        evidence: evidence('Дата рождения 28.02.2000'),
      },
      {
        field: 'snils',
        value: '112-233-445 95',
        evidence: evidence('СНИЛС 112 233 445 95'),
      },
      {
        field: 'debtTotal',
        value: '5200.10',
        evidence: evidence('Итого 5 200,10 руб.'),
      },
      {
        field: 'debts',
        value: [{ name: 'Банк Б', basis: 'Договор Б', amount: '7500.00' }],
        evidence: evidence(
          'Банк А | Договор А | 7500,00\nБанк Б | Договор Б |',
        ),
      },
    ],
    false,
  );
  expect(result.values.inn).toBeNull();
  expect(result.values.birthDate).toBeNull();
  expect(result.values.snils).toBe('112-233-445 95');
  expect(result.values.debtTotal).toBe('5200.10');
  expect(result.values.debts).toEqual([{ name: 'Банк Б', basis: 'Договор Б' }]);
  expect(result.candidates).toHaveLength(5);
});
