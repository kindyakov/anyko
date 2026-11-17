'use client';
import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import {
  deleteDocument,
  getDocumentDeletion,
  retryDocument,
  uploadDocument,
} from '@anyko/contracts/documents';

import { callApi } from '@/lib/api/call';
import { ApiError } from '@/lib/api/errors';

import { documentKeys } from './keys';

const deletionPollMs = 500;
const deletionDeadlineMs = 120_000;

function refreshList(client: QueryClient, workspaceId: string) {
  return client.invalidateQueries({ queryKey: documentKeys.list(workspaceId) });
}

// Ключ создаёт обработчик выбора файла: один файл — один ключ, повтор того же файла — тот же ключ.
export function useUploadDocument(workspaceId: string) {
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
    onSuccess: () => refreshList(client, workspaceId),
  });
}

export function useRetryDocument(
  workspaceId: string,
  refreshWork?: () => Promise<void>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) =>
      callApi(retryDocument, { params: { workspaceId, documentId } }),
    onSuccess: () =>
      Promise.all([refreshList(client, workspaceId), refreshWork?.()]),
  });
}

// Удаление принято сразу, но полное удаление завершается позже: команда ждёт его по getDocumentDeletion.
export function useDeleteDocument(workspaceId: string) {
  const client = useQueryClient();
  // Опрос завершения живёт, пока открыт экран: при уходе со страницы контроллер отменяет его.
  const screen = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    screen.current = controller;
    return () => {
      controller.abort();
    };
  }, []);
  return useMutation({
    mutationFn: async (documentId: string) => {
      // Отмена не касается самого запроса удаления: он уже мог дойти до сервера.
      await callApi(deleteDocument, { params: { workspaceId, documentId } });
      // Список показывает незавершённое удаление, пока его опрашивает эта команда.
      await refreshList(client, workspaceId);
      await waitForDeletion(workspaceId, documentId, screen.current?.signal);
    },
    onSuccess: () => refreshList(client, workspaceId),
  });
}

async function waitForDeletion(
  workspaceId: string,
  documentId: string,
  signal: AbortSignal | undefined,
) {
  const deadline = Date.now() + deletionDeadlineMs;
  while (!signal?.aborted && Date.now() < deadline) {
    const progress = await callApi(getDocumentDeletion, {
      params: { workspaceId, documentId },
      ...(signal ? { signal } : {}),
    });
    if (progress.status === 'needs-recovery')
      throw new ApiError('DELETION_NEEDS_RECOVERY', 409, undefined);
    if (progress.status === 'deleted') return;
    await new Promise((resolve) => setTimeout(resolve, deletionPollMs));
  }
  // Экран ушёл: результат ожидания некому показывать, ошибка не нужна.
  if (signal?.aborted) return;
  throw new ApiError('DELETION_PENDING', 202, undefined);
}
