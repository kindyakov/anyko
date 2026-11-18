import { queryOptions } from '@tanstack/react-query';

import {
  getDocument,
  getDocumentResult,
  getDocumentSource,
  listDocuments,
  type SourceFormat,
} from '@anyko/contracts/documents';
import {
  getWorkDocumentResult,
  getWorkDocumentSource,
} from '@anyko/contracts/works';

import { callApi, callFileApi } from '@/lib/api/call';
import { ApiError } from '@/lib/api/errors';

import {
  isRecognizing,
  recognitionPollInterval,
  recognitionPollMs,
} from '../model/poll';

import { documentKeys } from './keys';

export type DocumentFilters = {
  q: string;
  formats: readonly SourceFormat[];
};

export function documentsQueryOptions(
  workspaceId: string,
  filters: DocumentFilters,
  after?: string,
) {
  const query = {
    q: filters.q || undefined,
    formats: filters.formats.length
      ? [...filters.formats].sort().join(',')
      : undefined,
    after,
  };
  return queryOptions({
    queryKey: [...documentKeys.list(workspaceId), query],
    queryFn: ({ signal }) =>
      callApi(listDocuments, {
        params: { workspaceId },
        query,
        signal,
      }),
    refetchInterval: (query) =>
      query.state.data ? recognitionPollInterval(query.state.data) : false,
  });
}

export function recognitionStatusQueryOptions(
  workspaceId: string,
  documentId: string,
  revision: number,
) {
  return queryOptions({
    queryKey: [
      ...documentKeys.all(workspaceId),
      'status',
      documentId,
      revision,
    ],
    queryFn: async ({ signal }) => {
      try {
        return (
          await callApi(getDocument, {
            params: { workspaceId, documentId },
            signal,
          })
        ).document;
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    refetchInterval: ({ state: { data, error } }) => {
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403)
      )
        return false;
      return data === null ||
        (data &&
          (data.processingRevision ?? 0) >= revision &&
          !isRecognizing(data))
        ? false
        : recognitionPollMs;
    },
  });
}

// Владелец документа задаёт адреса: документ работы читается через работу, документ распознавания — напрямую.
export type DocumentOwner =
  { kind: 'work'; workId: string } | { kind: 'recognition'; revision?: number };

export function documentResultQueryOptions(
  workspaceId: string,
  documentId: string,
  owner: DocumentOwner,
) {
  const workId = owner.kind === 'work' ? owner.workId : undefined;
  const revision = owner.kind === 'recognition' ? owner.revision : undefined;
  return queryOptions({
    queryKey: documentKeys.result(workspaceId, documentId, workId, revision),
    queryFn: ({ signal }) =>
      workId === undefined
        ? callApi(getDocumentResult, {
            params: { workspaceId, documentId },
            query: { revision },
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
