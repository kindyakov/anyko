import { expect, test } from 'bun:test';

import type { WorkView } from '@anyko/contracts/works';

import { workView } from '../../../../test/fixtures';

import { reviewFields } from './review';

function fields(...keys: string[]): WorkView['package']['fields'] {
  return keys.map((key) => ({
    key,
    label: key,
    kind: 'text',
    multiline: false,
    columns: [],
    limits: {},
  }));
}

test('prioritizes a dispute and a blank field, leaving a reviewed empty list alone', () => {
  const values = { a: 'A', b: null, c: null, d: [] };
  const view: WorkView = {
    ...workView,
    package: { ...workView.package, fields: fields('a', 'b', 'c', 'd') },
    facts: {
      ...workView.facts,
      values,
      discrepancyFields: ['b'],
      candidates: [
        { field: 'a', value: 'A', selected: true, evidence: [] },
        { field: 'b', value: 'B', selected: false, evidence: [] },
        { field: 'c', value: 'C', selected: false, evidence: [] },
        { field: 'd', value: [], selected: true, evidence: [] },
      ],
    },
  };
  const result = reviewFields(view, values, 'attention');
  expect(result.visible.map(({ field }) => field.key)).toEqual(['b', 'c']);
  expect(result.quick.map(({ field }) => field.key)).toEqual(['c']);
  expect([result.complete, result.total]).toEqual([2, 4]);
});

test('attention includes lost evidence and quick apply excludes competing values', () => {
  const view: WorkView = {
    ...workView,
    package: {
      ...workView.package,
      fields: fields('firstName', 'lastName', 'documentDate'),
    },
    facts: {
      ...workView.facts,
      values: {
        firstName: 'Мария',
        lastName: null,
        documentDate: '30.10.2023',
      },
      discrepancyFields: ['firstName'],
      needsReview: ['documentDate'],
      candidates: [
        { field: 'firstName', value: 'Анна', selected: false, evidence: [] },
        { field: 'lastName', value: 'Иванова', selected: false, evidence: [] },
        { field: 'lastName', value: 'Иванов', selected: false, evidence: [] },
      ],
    },
  };
  const result = reviewFields(
    view,
    { ...view.facts.values, firstName: 'Анна' },
    'attention',
  );
  expect(result.visible.map(({ field }) => field.key)).toEqual([
    'firstName',
    'lastName',
    'documentDate',
  ]);
  expect(result.quick).toEqual([]);
});

test('a sole inferred proposal stays in individual review and is excluded from bulk filling', () => {
  const values = { district: null, firstName: null };
  const view: WorkView = {
    ...workView,
    package: { ...workView.package, fields: fields('district', 'firstName') },
    facts: {
      ...workView.facts,
      values,
      candidates: [
        {
          field: 'district',
          value: 'Тестовый район',
          selected: false,
          origin: 'inference',
          explanation: 'Район предполагается по городу.',
          evidence: [],
        },
        {
          field: 'firstName',
          value: 'Анна',
          selected: false,
          origin: 'document',
          evidence: [],
        },
      ],
    },
  };
  const result = reviewFields(view, values, 'attention');
  expect(result.visible.map(({ field }) => field.key)).toEqual([
    'district',
    'firstName',
  ]);
  expect(result.quick.map(({ field }) => field.key)).toEqual(['firstName']);
});
