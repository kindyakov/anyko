import { expect, test } from 'bun:test';
import { emptyFacts, editFacts, mergeCandidates } from './index';
import type { WorkFacts } from '@anyko/contracts';

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
      { documentId: crypto.randomUUID(), imagePath: null, quote: basis },
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
