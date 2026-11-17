import type { WorkPage } from '@anyko/contracts/works';

export type WorkFilter = 'all' | 'draft' | 'confirmed';

export function filterWorks(
  works: WorkPage['works'],
  search: string,
  filter: WorkFilter,
) {
  return works.filter(
    (work) =>
      work.title
        .toLocaleLowerCase('ru')
        .includes(search.toLocaleLowerCase('ru')) &&
      (filter === 'all' ||
        (work.confirmedRevision === work.revision
          ? filter === 'confirmed'
          : filter === 'draft')),
  );
}
