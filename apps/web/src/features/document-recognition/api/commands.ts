'use client';
import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import {
  createDocumentDeletions,
  deleteDocument,
  documentDeletionBatchLimit,
  type DocumentSummary,
  getDocumentDeletion,
  getDocumentDeletionImpact,
  getDocumentDeletionImpacts,
  getDocumentDeletions,
  retryDocument,
  uploadDocument,
} from '@anyko/contracts/documents';

import { callApi } from '@/lib/api/call';
import { ApiError, isUnauthorized } from '@/lib/api/errors';

import { documentKeys } from './keys';

const deletionPollMs = 500;
const deletionDeadlineMs = 120_000;
const concurrentDocuments = 4;

export function invalidateDocumentCatalog(
  client: QueryClient,
  workspaceId: string,
) {
  return client.invalidateQueries({ queryKey: documentKeys.list(workspaceId) });
}

function requestRetry(workspaceId: string, documentId: string) {
  return callApi(retryDocument, { params: { workspaceId, documentId } });
}

// Ключ создаёт обработчик выбора файла: один файл — один ключ, повтор того же файла — тот же ключ.
export function useUploadDocument(
  workspaceId: string,
  track: (document: DocumentSummary) => void,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      idempotencyKey,
    }: {
      file: File;
      idempotencyKey: string;
    }) =>
      callApi(uploadDocument, {
        params: { workspaceId },
        body: { file },
        idempotencyKey,
      }),
    onSuccess: ({ document }) => {
      track(document);
      return invalidateDocumentCatalog(client, workspaceId);
    },
  });
}

export function useRetryDocument(
  workspaceId: string,
  refreshWork?: () => Promise<void>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => requestRetry(workspaceId, documentId),
    onSuccess: () =>
      Promise.all([
        invalidateDocumentCatalog(client, workspaceId),
        refreshWork?.(),
      ]),
  });
}

type RecognitionAction = {
  kind: 'retry' | 'delete';
  documentIds: string[];
  bulk: boolean;
  impacts?: ReadonlyMap<string, string> | undefined;
};

async function runForDocuments(
  documentIds: string[],
  signal: AbortSignal | undefined,
  command: (documentId: string) => Promise<unknown>,
  concurrency = concurrentDocuments,
) {
  const succeeded: string[] = [];
  const failed: { id: string; error: unknown }[] = [];
  for (let offset = 0; offset < documentIds.length; offset += concurrency) {
    if (signal?.aborted) break;
    const group = documentIds.slice(offset, offset + concurrency);
    const outcomes = await Promise.allSettled(group.map(command));
    for (const [index, id] of group.entries()) {
      const outcome = outcomes[index];
      if (outcome?.status === 'rejected') {
        const error: unknown = outcome.reason;
        if (isUnauthorized(error)) throw error;
        failed.push({ id, error });
      } else {
        succeeded.push(id);
      }
    }
  }
  return { succeeded, failed };
}

function* deletionBatches<T>(documents: readonly T[]) {
  for (
    let offset = 0;
    offset < documents.length;
    offset += documentDeletionBatchLimit
  )
    yield documents.slice(offset, offset + documentDeletionBatchLimit);
}

export async function readDeletionImpacts(
  workspaceId: string,
  documents: readonly DocumentSummary[],
  signal: AbortSignal,
) {
  if (documents.length === 1) {
    const [document] = documents;
    if (document)
      return [
        {
          id: document.id,
          filename: document.filename,
          ...(await callApi(getDocumentDeletionImpact, {
            params: { workspaceId, documentId: document.id },
            signal,
          })),
        },
      ];
  }
  const filenames = new Map(
    documents.map(({ id, filename }) => [id, filename]),
  );
  const items = [];
  for (const batch of deletionBatches(documents)) {
    const { impacts } = await callApi(getDocumentDeletionImpacts, {
      params: { workspaceId },
      query: { documentIds: batch.map(({ id }) => id).join(',') },
      signal,
    });
    for (const { documentId, ...impact } of impacts)
      items.push({
        id: documentId,
        filename: filenames.get(documentId) ?? documentId,
        ...impact,
      });
  }
  return items;
}

async function requestBulkDeletion(
  workspaceId: string,
  documentIds: string[],
  impacts: ReadonlyMap<string, string> | undefined,
  signal: AbortSignal | undefined,
) {
  const succeeded: string[] = [];
  const failed: { id: string; error: ApiError }[] = [];
  for (const batch of deletionBatches(documentIds)) {
    const documents = batch.map((documentId) => {
      const impact = impacts?.get(documentId);
      if (!impact) throw new ApiError('REVISION_CONFLICT', 409, undefined);
      return { documentId, impact };
    });
    const { results } = await callApi(createDocumentDeletions, {
      params: { workspaceId },
      body: { documents },
      ...(signal ? { signal } : {}),
    });
    for (const result of results) {
      if (result.status === 'deleting') succeeded.push(result.documentId);
      else
        failed.push({
          id: result.documentId,
          error: new ApiError(result.code, undefined, undefined),
        });
    }
  }
  return { succeeded, failed };
}

export function useRecognitionAction(
  workspaceId: string,
  track: (document: DocumentSummary) => void,
  onDeletionAccepted?: () => Promise<void>,
) {
  const client = useQueryClient();
  const screen = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    screen.current = controller;
    return () => {
      controller.abort();
    };
  }, []);
  return useMutation({
    mutationFn: async ({ kind, documentIds, impacts }: RecognitionAction) => {
      const signal = screen.current?.signal;
      if (kind === 'retry')
        return runForDocuments(documentIds, signal, async (id) => {
          const { document } = await requestRetry(workspaceId, id);
          track(document);
        });

      const requested =
        documentIds.length > 1
          ? await requestBulkDeletion(workspaceId, documentIds, impacts, signal)
          : await runForDocuments(documentIds, signal, (documentId) =>
              callApi(deleteDocument, {
                params: { workspaceId, documentId },
                query: { impact: impacts?.get(documentId) },
              }),
            );
      if (!requested.succeeded.length) return requested;
      // Сначала отправляем все удаления. Список показывает принятые операции, пока мы ждём их завершения.
      await Promise.all([
        invalidateDocumentCatalog(client, workspaceId),
        onDeletionAccepted?.(),
      ]);
      const deadline = Date.now() + deletionDeadlineMs;
      const completed =
        documentIds.length > 1
          ? await waitForBulkDeletion(
              workspaceId,
              requested.succeeded,
              deadline,
              signal,
            )
          : await runForDocuments(requested.succeeded, signal, (id) =>
              waitForDeletion(workspaceId, id, deadline, signal),
            );
      return {
        succeeded: completed.succeeded,
        failed: [...requested.failed, ...completed.failed],
      };
    },
    onSettled: () =>
      Promise.all([
        invalidateDocumentCatalog(client, workspaceId),
        client.invalidateQueries({
          queryKey: documentKeys.deletionImpact(workspaceId),
        }),
      ]),
  });
}

async function waitForBulkDeletion(
  workspaceId: string,
  documentIds: string[],
  deadline: number,
  signal: AbortSignal | undefined,
) {
  const pending = new Set(documentIds);
  const succeeded: string[] = [];
  const failed: { id: string; error: ApiError }[] = [];
  while (pending.size && !signal?.aborted) {
    for (const batch of deletionBatches([...pending])) {
      const { results } = await callApi(getDocumentDeletions, {
        params: { workspaceId },
        query: { documentIds: batch.join(',') },
        ...(signal ? { signal } : {}),
      });
      for (const { documentId, status } of results) {
        if (status === 'deleting') continue;
        pending.delete(documentId);
        if (status === 'deleted') succeeded.push(documentId);
        else
          failed.push({
            id: documentId,
            error: new ApiError('DELETION_NEEDS_RECOVERY', 409, undefined),
          });
      }
    }
    if (!pending.size || Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, deletionPollMs));
  }
  if (!signal?.aborted)
    for (const id of pending)
      failed.push({
        id,
        error: new ApiError('DELETION_PENDING', 202, undefined),
      });
  return { succeeded, failed };
}

async function waitForDeletion(
  workspaceId: string,
  documentId: string,
  deadline: number,
  signal: AbortSignal | undefined,
) {
  while (!signal?.aborted) {
    const progress = await callApi(getDocumentDeletion, {
      params: { workspaceId, documentId },
      ...(signal ? { signal } : {}),
    });
    if (progress.status === 'needs-recovery')
      throw new ApiError('DELETION_NEEDS_RECOVERY', 409, undefined);
    if (progress.status === 'deleted') return;
    if (Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, deletionPollMs));
  }
  // Экран ушёл: результат ожидания некому показывать, ошибка не нужна.
  if (signal?.aborted) return;
  throw new ApiError('DELETION_PENDING', 202, undefined);
}
