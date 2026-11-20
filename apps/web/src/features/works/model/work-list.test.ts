import { expect, test } from 'bun:test';

import { readWorkListParams, workListHref } from './work-list';

test('a works link preserves search, filter, page and layout', () => {
  const params = readWorkListParams(
    new URLSearchParams(
      'q=%D0%90%D0%BD%D0%BD%D0%B0&status=confirmed&page=3&pageSize=12&view=list',
    ),
  );
  expect(params).toEqual({
    q: 'Анна',
    status: 'confirmed',
    page: 3,
    pageSize: 12,
    view: 'list',
  });
  expect(workListHref('local', params)).toBe(
    '/w/local/works?q=%D0%90%D0%BD%D0%BD%D0%B0&status=confirmed&page=3&pageSize=12&view=list',
  );
});

test('invalid options fall back to the first page of all works', () => {
  const params = readWorkListParams(
    new URLSearchParams('status=old&page=-2&pageSize=999&view=other'),
  );
  expect(params.pageSize).toBe(24);
  expect(workListHref('local', params)).toBe('/w/local/works');
});
