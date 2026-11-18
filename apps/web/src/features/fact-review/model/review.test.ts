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

test('the conflicts filter selects the fields supplied by the server', () => {
  const view = {
    package: { fields: [{ key: 'firstName' }, { key: 'lastName' }] },
    facts: {
      discrepancyFields: ['firstName'],
      candidates: [
        { field: 'firstName', value: 'Анна' },
        { field: 'lastName', value: 'Иванова' },
        { field: 'lastName', value: 'Иванов' },
      ],
    },
  } as WorkView;
  const result = reviewFields(view, { firstName: 'Анна' }, 'conflicts');
  expect(result.visible.map(({ field }) => field.key)).toEqual(['firstName']);
});
