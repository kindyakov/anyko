import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import {
  getDocumentResult,
  getDocumentSource,
  listDocuments,
} from '@anyko/contracts/documents';
import {
  getWorkDocumentResult,
  getWorkDocumentSource,
} from '@anyko/contracts/works';

import { callApi, callFileApi } from '@/lib/api/call';

import { recognitionPollInterval } from '../model/poll';

import { documentKeys } from './keys';

export function documentsQueryOptions(workspaceId: string) {
  return infiniteQueryOptions({
    queryKey: documentKeys.list(workspaceId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ signal, pageParam }) =>
      callApi(listDocuments, {
        params: { workspaceId },
        query: { after: pageParam },
        signal,
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    // При опросе обновляются загруженные страницы, включая состояние удалений.
    refetchInterval: (query) =>
      query.state.data?.pages.map(recognitionPollInterval).find(Boolean) ??
      false,
  });
}

// Владелец документа задаёт адреса: документ работы читается через работу, документ распознавания — напрямую.
export type DocumentOwner =
  { kind: 'work'; workId: string } | { kind: 'recognition' };

export function documentResultQueryOptions(
  workspaceId: string,
  documentId: string,
  owner: DocumentOwner,
) {
  const workId = owner.kind === 'work' ? owner.workId : undefined;
  return queryOptions({
    queryKey: documentKeys.result(workspaceId, documentId, workId),
    queryFn: ({ signal }) =>
      workId === undefined
        ? callApi(getDocumentResult, {
            params: { workspaceId, documentId },
            signal,
          })
        : callApi(getWorkDocumentResult, {
            params: { workspaceId, workId, documentId },
            signal,
          }),
  });
}

export function documentSourceQueryOptions(
  workspaceId: string,
  documentId: string,
  owner: DocumentOwner,
) {
  const workId = owner.kind === 'work' ? owner.workId : undefined;
  return queryOptions({
    queryKey: documentKeys.source(workspaceId, documentId, workId),
    gcTime: 0,
    retry: false,
    queryFn: ({ signal }) =>
      workId === undefined
        ? callFileApi(getDocumentSource, {
            params: { workspaceId, documentId },
            signal,
          })
        : callFileApi(getWorkDocumentSource, {
            params: { workspaceId, workId, documentId },
            signal,
          }),
  });
}
