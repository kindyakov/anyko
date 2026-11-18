import {
  type QueryClient,
  queryOptions,
  skipToken,
} from '@tanstack/react-query';

import { listDocumentPackages } from '@anyko/contracts/catalog';
import {
  defaultWorkPageSize,
  getWork,
  getWorkDeletion,
  listWorks,
  type WorkListStatus,
  type WorkPage,
} from '@anyko/contracts/works';

import { callApi } from '@/lib/api/call';

import { documentPackageKeys, workKeys } from './keys';

export function invalidateWorkspaceWorks(
  client: QueryClient,
  workspaceId: string,
) {
  return client.invalidateQueries({ queryKey: workKeys.all(workspaceId) });
}

export function worksQueryOptions(
  workspaceId: string,
  query: { page: number; pageSize: number; q: string; status: WorkListStatus },
) {
  return queryOptions({
    queryKey: [...workKeys.list(workspaceId), query] as const,
    placeholderData: (data: WorkPage | undefined, previous) =>
      previous?.queryKey[1] === workspaceId &&
      previous.queryKey[3].q === query.q &&
      previous.queryKey[3].status === query.status
        ? data
        : undefined,
    queryFn: ({ signal }) =>
      callApi(listWorks, {
        params: { workspaceId },
        query: {
          page: query.page,
          ...(query.pageSize === defaultWorkPageSize
            ? {}
            : { pageSize: query.pageSize }),
          ...(query.q ? { q: query.q } : {}),
          ...(query.status === 'all' ? {} : { status: query.status }),
        },
        signal,
      }),
    refetchInterval: (entry) =>
      entry.state.data?.deletions.length ? 1500 : false,
  });
}

export function workDeletionQueryOptions(
  workspaceId: string,
  workId: string | undefined,
) {
  return queryOptions({
    queryKey: workKeys.deletion(workspaceId, workId),
    staleTime: 0,
    queryFn: workId
      ? ({ signal }) =>
          callApi(getWorkDeletion, { params: { workspaceId, workId }, signal })
      : skipToken,
    refetchInterval: (entry) =>
      entry.state.data?.status === 'deleted' ? false : 1500,
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
