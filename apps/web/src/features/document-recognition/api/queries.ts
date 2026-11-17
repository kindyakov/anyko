import { queryOptions } from '@tanstack/react-query';

import { getDocumentResult, listDocuments } from '@anyko/contracts/documents';

import { callApi } from '@/lib/api/call';

import { recognitionPollInterval } from '../model/poll';

import { documentKeys } from './keys';

export function documentsQueryOptions(workspaceId: string) {
  return queryOptions({
    queryKey: documentKeys.list(workspaceId),
    queryFn: ({ signal }) =>
      callApi(listDocuments, { params: { workspaceId }, signal }),
    // Список обновляется сам, пока есть документ в обработке или незавершённое удаление.
    refetchInterval: (query) => recognitionPollInterval(query.state.data),
  });
}

export function documentResultQueryOptions(
  workspaceId: string,
  documentId: string,
) {
  return queryOptions({
    queryKey: documentKeys.result(workspaceId, documentId),
    queryFn: ({ signal }) =>
      callApi(getDocumentResult, {
        params: { workspaceId, documentId },
        signal,
      }),
  });
}
