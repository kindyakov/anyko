import { queryOptions } from '@tanstack/react-query';

import { getDocumentResult, listDocuments } from '@anyko/contracts/documents';
import { getWorkDocumentResult } from '@anyko/contracts/works';

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
