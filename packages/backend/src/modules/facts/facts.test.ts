import { expect, test } from 'bun:test';

import type { WorkFacts } from './schemas';

import {
  confirmFacts,
  editFacts,
  emptyFacts,
  findFactDiscrepancies,
  mergeCandidates,
} from './index';

const candidate = (value: string): WorkFacts['candidates'][number] => ({
  field: 'personName',
  value,
  evidence: [
    { documentId: crypto.randomUUID(), imagePath: null, quote: value },
  ],
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
  expect(findFactDiscrepancies(result)).toEqual(['personName']);
});
test('manual values survive new extraction, including an intentionally cleared field', () => {
  const initial = mergeCandidates(emptyFacts(), [candidate('Анна')], false);
  const manual = editFacts(initial, { ...initial.values, personName: null });
  const result = mergeCandidates(manual, [candidate('Ирина')], false);
  expect(result.values.personName).toBeNull();
  expect(findFactDiscrepancies(result)).toEqual(['personName']);
});
test('confirmed values survive conflicting extraction while new candidates remain reviewable', () => {
  const initial = mergeCandidates(emptyFacts(), [candidate('Анна')], false);
  const confirmed = confirmFacts(initial);
  expect(findFactDiscrepancies(confirmed)).toEqual([]);
  const result = mergeCandidates(confirmed, [candidate('Ирина')], true);
  expect(result.values.personName).toBe('Анна');
  expect(result.candidates[0]?.value).toBe('Ирина');
  expect(findFactDiscrepancies(result)).toEqual(['personName']);
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
  expect(findFactDiscrepancies(merged)).toEqual([]);
  const conflict = mergeCandidates(
    emptyFacts(),
    [table('Договор А', '100.00'), table('Договор А', '999.00')],
    false,
  );
  expect(conflict.values.debts).toBeNull();
  expect(conflict.candidates).toHaveLength(2);
  expect(findFactDiscrepancies(conflict)).toEqual(['debts']);
  const manual = editFacts(merged, { ...merged.values, debts: [] });
  expect(
    mergeCandidates(manual, [table('Договор В', '300.00')], false).values.debts,
  ).toEqual([]);
});

test('a manually saved value changes discrepancy status', () => {
  const extracted = mergeCandidates(emptyFacts(), [candidate('Анна')], false);
  const changed = editFacts(extracted, {
    ...extracted.values,
    personName: 'Ирина',
  });
  expect(findFactDiscrepancies(changed)).toEqual(['personName']);
  const restored = editFacts(changed, {
    ...changed.values,
    personName: 'Анна',
  });
  expect(findFactDiscrepancies(restored)).toEqual([]);
});

test('a saved table matches regardless of row order but differs when an obligation is omitted', () => {
  const first = { name: 'Банк А', basis: 'Договор А', amount: '100.00' };
  const second = { name: 'Банк Б', basis: 'Договор Б', amount: '200.00' };
  const extracted = mergeCandidates(
    emptyFacts(),
    [
      {
        field: 'debts',
        value: [first, second],
        evidence: [
          {
            documentId: crypto.randomUUID(),
            imagePath: null,
            quote: 'Банк А | Договор А | 100,00\nБанк Б | Договор Б | 200,00',
          },
        ],
      },
    ],
    false,
  );
  const reordered = editFacts(extracted, {
    ...extracted.values,
    debts: [second, first],
  });
  expect(findFactDiscrepancies(reordered)).toEqual([]);
  const reduced = editFacts(reordered, { ...reordered.values, debts: [first] });
  expect(findFactDiscrepancies(reduced)).toEqual(['debts']);
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
