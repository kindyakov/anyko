import { expect, test } from 'bun:test';

import type { WorkView } from '@anyko/contracts/works';

import { reviewFields } from './review';

test('selects pending candidates and excludes filled or disputed values from quick apply', () => {
  const view = {
    package: {
      fields: [{ key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }],
    },
    facts: {
      discrepancyFields: ['b'],
      candidates: [
        { field: 'a', value: 'A' },
        { field: 'b', value: 'B' },
        { field: 'c', value: 'C' },
      ],
    },
  } as WorkView;
  const values = { a: 'A', b: null, c: null, d: [] };
  const result = reviewFields(view, values, 'pending');
  expect(result.visible.map(({ field }) => field.key)).toEqual(['b', 'c']);
  expect(result.quick.map(({ field }) => field.key)).toEqual(['c']);
  expect([result.complete, result.total]).toEqual([1, 4]);
});
