import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { packagesResponseSchema, worksResponseSchema } from '@anyko/contracts';

import { requestApi } from '@/lib/api/client';

import { documentPackageKeys, workKeys } from './keys';

export function worksQueryOptions(workspaceId: string) {
  return infiniteQueryOptions({
    queryKey: workKeys.list(workspaceId),
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) =>
      requestApi('/works', worksResponseSchema, {
        signal,
        ...(pageParam ? { query: { after: pageParam } } : {}),
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function documentPackagesQueryOptions(workspaceId: string) {
  return queryOptions({
    queryKey: documentPackageKeys.list(workspaceId),
    queryFn: ({ signal }) =>
      requestApi('/document-packages', packagesResponseSchema, { signal }),
  });
}
