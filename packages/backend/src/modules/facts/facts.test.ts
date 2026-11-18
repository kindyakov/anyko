import { expect, test } from 'bun:test';

import {
  confirmFacts,
  editFacts,
  emptyFacts,
  findFactDiscrepancies,
  markSelectedCandidates,
  mergeCandidates,
} from './domain/values';
import type { WorkFacts } from './schemas';

import { type FactEvidence, refreshFactEvidence } from './index';

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

test('a manually saved value changes discrepancy status', () => {
  const extracted = mergeCandidates(emptyFacts(), [candidate('Анна')], false);
  expect(markSelectedCandidates(extracted)[0]?.selected).toBe(true);
  const changed = editFacts(extracted, {
    ...extracted.values,
    personName: 'Ирина',
  });
  expect(markSelectedCandidates(changed)[0]?.selected).toBe(false);
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

test.each([
  {
    field: 'birthDate',
    value: '01.02.2020',
    quote: 'Дата рождения 2020-02-01',
  },
  { field: 'debtTotal', value: '5 200,1', quote: 'Итого 5200.10 руб.' },
  { field: 'inn', value: '5001 0073 2259', quote: 'ИНН 500100732259' },
  { field: 'snils', value: '112-233-445 95', quote: 'СНИЛС 112 233 445 95' },
] as const)(
  'confirming the automatic value of $field works with or without evidence',
  ({ field, value, quote }) => {
    for (const [citation, expected] of [
      [quote, value],
      ['Значение отсутствует', null],
    ] as const) {
      const saved = mergeCandidates(
        emptyFacts(),
        [
          {
            field,
            value,
            evidence: [
              {
                documentId: crypto.randomUUID(),
                imagePath: null,
                quote: citation,
              },
            ],
          },
        ],
        false,
      );
      expect(saved.values[field]).toBe(expected);
      expect(findFactDiscrepancies(confirmFacts(saved))).toEqual([]);
    }
  },
);

test('confirming a suggested table without a supported amount only compares the saved columns', () => {
  const saved = mergeCandidates(
    emptyFacts(),
    [
      {
        field: 'debts',
        value: [{ name: 'Банк А', basis: 'Договор А', amount: '100.00' }],
        evidence: [
          {
            documentId: crypto.randomUUID(),
            imagePath: null,
            quote: 'Банк А | Договор А',
          },
        ],
      },
    ],
    false,
  );
  expect(saved.values.debts).toEqual([{ name: 'Банк А', basis: 'Договор А' }]);
  expect(findFactDiscrepancies(confirmFacts(saved))).toEqual([]);
});

test('a manual numeric correction and an intentional clearing remain discrepancies', () => {
  const supported: WorkFacts['candidates'][number] = {
    field: 'debtTotal',
    value: '100.00',
    evidence: [
      {
        documentId: crypto.randomUUID(),
        imagePath: null,
        quote: 'Итого 100,00 руб.',
      },
    ],
  };
  const extracted = mergeCandidates(emptyFacts(), [supported], false);
  const changed = editFacts(extracted, {
    ...extracted.values,
    debtTotal: '150.00',
  });
  expect(findFactDiscrepancies(confirmFacts(changed))).toEqual(['debtTotal']);
  const cleared = editFacts(extracted, {
    ...extracted.values,
    debtTotal: null,
  });
  const unsupported = {
    ...supported,
    evidence: [
      {
        documentId: crypto.randomUUID(),
        imagePath: null,
        quote: 'Итого без суммы',
      },
    ],
  };
  const refreshed = mergeCandidates(cleared, [unsupported], false);
  expect(findFactDiscrepancies(confirmFacts(refreshed))).toEqual(['debtTotal']);
});

test('selection follows contributing cells and the same row identity after manual edits', () => {
  const evidence = (quote: string) => [
    { documentId: crypto.randomUUID(), imagePath: null, quote },
  ];
  const field = 'debts';
  const first = { name: 'Банк А', basis: 'Договор А' };
  const second = { name: 'Банк Б', basis: 'Договор Б' };
  const extracted = mergeCandidates(
    emptyFacts(),
    [
      {
        field,
        value: [{ ...first, amount: '100.00' }, second],
        evidence: evidence('Банк А | Договор А'),
      },
      {
        field,
        value: [{ ...first, arrears: '50.00' }],
        evidence: evidence('Банк А | Договор А | 50,00'),
      },
    ],
    false,
  );
  expect(extracted.values.debts).toEqual([
    { ...first, arrears: '50.00' },
    second,
  ]);
  expect(
    markSelectedCandidates(extracted).map(({ selected }) => selected),
  ).toEqual([true, true]);
  const manuallyEdited = editFacts(extracted, {
    ...extracted.values,
    debts: [{ ...first, arrears: '25.00' }],
  });
  expect(
    markSelectedCandidates(manuallyEdited).map(({ selected }) => selected),
  ).toEqual([false, false]);
});

test('a numeric candidate with no accepted value is selected only if the lawyer saves it', () => {
  const extracted = mergeCandidates(
    emptyFacts(),
    [
      {
        field: 'inn',
        value: '500100732259',
        evidence: [
          {
            documentId: crypto.randomUUID(),
            imagePath: null,
            quote: 'ИНН не указан',
          },
        ],
      },
    ],
    false,
  );
  expect(markSelectedCandidates(extracted)[0]?.selected).toBe(false);
  const manuallySelected = editFacts(extracted, {
    ...extracted.values,
    inn: '500100732259',
  });
  expect(markSelectedCandidates(manuallySelected)[0]?.selected).toBe(true);
});

test('saving the original unsupported amount after checking the document clears the discrepancy', () => {
  const extracted = mergeCandidates(
    emptyFacts(),
    [
      {
        field: 'debtTotal',
        value: '100.00',
        evidence: [
          {
            documentId: crypto.randomUUID(),
            imagePath: null,
            quote: 'Итого без суммы',
          },
        ],
      },
    ],
    false,
  );
  expect(extracted.values.debtTotal).toBeNull();
  const reviewed = editFacts(extracted, {
    ...extracted.values,
    debtTotal: '100.00',
  });
  expect(findFactDiscrepancies(reviewed)).toEqual([]);
  expect(findFactDiscrepancies(confirmFacts(reviewed))).toEqual([]);
});

test('an explicitly saved original table can match one of the compatible candidates', () => {
  const evidence = [
    {
      documentId: crypto.randomUUID(),
      imagePath: null,
      quote: 'Список долгов',
    },
  ];
  const first = { name: 'Банк А', basis: 'Договор А' };
  const second = { name: 'Банк Б', basis: 'Договор Б' };
  const extracted = mergeCandidates(
    emptyFacts(),
    [
      { field: 'debts', value: [first], evidence },
      { field: 'debts', value: [second], evidence },
    ],
    false,
  );
  expect(extracted.values.debts).toEqual([first, second]);
  const reviewed = editFacts(extracted, {
    ...extracted.values,
    debts: [first],
  });
  expect(findFactDiscrepancies(confirmFacts(reviewed))).toEqual([]);
});

test('an unsupported table amount is not selected when a different amount was saved in its row', () => {
  const row = { name: 'Банк А', basis: 'Договор А' };
  const extracted = mergeCandidates(
    emptyFacts(),
    [
      {
        field: 'debts',
        value: [{ ...row, amount: '100.00' }],
        evidence: [
          {
            documentId: crypto.randomUUID(),
            imagePath: null,
            quote: 'Банк А | Договор А',
          },
        ],
      },
    ],
    false,
  );
  expect(extracted.values.debts).toEqual([row]);
  expect(markSelectedCandidates(extracted)[0]?.selected).toBe(true);
  const revised = editFacts(extracted, {
    ...extracted.values,
    debts: [{ ...row, amount: '150.00' }],
  });
  expect(markSelectedCandidates(revised)[0]?.selected).toBe(false);
  const selected = editFacts(revised, {
    ...revised.values,
    debts: [{ ...row, amount: '100.00' }],
  });
  expect(markSelectedCandidates(selected)[0]?.selected).toBe(true);
});

test('a candidate for an empty table only matches a saved empty table', () => {
  const extracted = mergeCandidates(
    emptyFacts(),
    [
      {
        field: 'debts',
        value: [],
        evidence: [
          {
            documentId: crypto.randomUUID(),
            imagePath: null,
            quote: 'Обязательств нет',
          },
        ],
      },
    ],
    false,
  );
  expect(markSelectedCandidates(extracted)[0]?.selected).toBe(true);
  const manuallyEdited = editFacts(extracted, {
    ...extracted.values,
    debts: [{ name: 'Банк А', basis: 'Договор А' }],
  });
  expect(markSelectedCandidates(manuallyEdited)[0]?.selected).toBe(false);
});
