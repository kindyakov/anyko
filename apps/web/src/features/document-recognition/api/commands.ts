'use client';
import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import {
  deleteDocument,
  type DocumentSummary,
  getDocumentDeletion,
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
};

async function runForDocuments(
  documentIds: string[],
  signal: AbortSignal | undefined,
  command: (documentId: string) => Promise<unknown>,
) {
  const succeeded: string[] = [];
  const failed: { id: string; error: unknown }[] = [];
  for (
    let offset = 0;
    offset < documentIds.length;
    offset += concurrentDocuments
  ) {
    if (signal?.aborted) break;
    const group = documentIds.slice(offset, offset + concurrentDocuments);
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

export function useRecognitionAction(
  workspaceId: string,
  track: (document: DocumentSummary) => void,
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
    mutationFn: async ({ kind, documentIds }: RecognitionAction) => {
      const signal = screen.current?.signal;
      if (kind === 'retry')
        return runForDocuments(documentIds, signal, async (id) => {
          const { document } = await requestRetry(workspaceId, id);
          track(document);
        });

      const requested = await runForDocuments(
        documentIds,
        signal,
        (documentId) =>
          callApi(deleteDocument, { params: { workspaceId, documentId } }),
      );
      if (!requested.succeeded.length) return requested;
      // Сначала отправляем все удаления. Список показывает принятые операции, пока мы ждём их завершения.
      await invalidateDocumentCatalog(client, workspaceId);
      const deadline = Date.now() + deletionDeadlineMs;
      const completed = await runForDocuments(
        requested.succeeded,
        signal,
        (id) => waitForDeletion(workspaceId, id, deadline, signal),
      );
      return {
        succeeded: completed.succeeded,
        failed: [...requested.failed, ...completed.failed],
      };
    },
    onSettled: () => invalidateDocumentCatalog(client, workspaceId),
  });
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
