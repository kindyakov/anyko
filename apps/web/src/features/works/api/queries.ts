import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { listDocumentPackages } from '@anyko/contracts/catalog';
import { getWork, listWorks } from '@anyko/contracts/works';

import { callApi } from '@/lib/api/call';

import { documentPackageKeys, workKeys } from './keys';

export function worksQueryOptions(workspaceId: string) {
  return infiniteQueryOptions({
    queryKey: workKeys.list(workspaceId),
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) =>
      callApi(listWorks, {
        params: { workspaceId },
        ...(pageParam ? { query: { after: pageParam } } : {}),
        signal,
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function workQueryOptions(workspaceId: string, workId: string) {
  return queryOptions({
    queryKey: workKeys.detail(workspaceId, workId),
    queryFn: ({ signal }) =>
      callApi(getWork, { params: { workspaceId, workId }, signal }),
  });
}

export function documentPackagesQueryOptions(workspaceId: string) {
  return queryOptions({
    queryKey: documentPackageKeys.list(workspaceId),
    queryFn: ({ signal }) => callApi(listDocumentPackages, { signal }),
  });
}
