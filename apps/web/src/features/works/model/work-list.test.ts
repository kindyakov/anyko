import { expect, test } from 'bun:test';

import type { WorkPage } from '@anyko/contracts/works';

import { filterWorks } from './work-list';

test('filters loaded works by case insensitive Russian title and current confirmation', () => {
  const works = [
    { title: 'ИВАНОВ', revision: 2, confirmedRevision: 2 },
    { title: 'Иванова', revision: 2, confirmedRevision: 1 },
    { title: 'Петров', revision: 1, confirmedRevision: null },
  ] as WorkPage['works'];
  expect(filterWorks(works, 'иван', 'all').map((work) => work.title)).toEqual([
    'ИВАНОВ',
    'Иванова',
  ]);
  expect(
    filterWorks(works, 'ИВАН', 'confirmed').map((work) => work.title),
  ).toEqual(['ИВАНОВ']);
  expect(filterWorks(works, 'иван', 'draft').map((work) => work.title)).toEqual(
    ['Иванова'],
  );
  expect(filterWorks(works, '', 'draft').map((work) => work.title)).toEqual([
    'Иванова',
    'Петров',
  ]);
});
