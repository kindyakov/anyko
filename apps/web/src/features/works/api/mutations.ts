'use client';
import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import type { FieldValues } from '@anyko/contracts/catalog';
import {
  analyzeWork,
  attachWorkDocuments,
  confirmWork,
  createWork,
  deleteWork,
  editWork,
} from '@anyko/contracts/works';

import { callApi } from '@/lib/api/call';
import { useIdempotencyKey, withIdempotencyKey } from '@/lib/api/idempotency';

import { workKeys } from './keys';

// Тело сохранения сведений: значения формы и ревизия работы, на которой начаты правки.
type FactsDraft = { values: FieldValues; revision: number };

type CreateWorkInput = {
  title: string;
  packageVersion: string;
  documentIds?: string[];
};

// Команда меняет работу и её строку в списке: после успеха обе части кэша становятся устаревшими.
export async function invalidateWork(
  client: QueryClient,
  workspaceId: string,
  workId: string,
): Promise<void> {
  await Promise.all([
    client.invalidateQueries({
      queryKey: workKeys.detail(workspaceId, workId),
    }),
    client.invalidateQueries({ queryKey: workKeys.list(workspaceId) }),
  ]);
}

// Ключ идемпотентности создаёт обработчик клика или отправки и передаёт его в переменных.
export function useCreateWork(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      title,
      packageVersion,
      documentIds,
      idempotencyKey,
    }: CreateWorkInput & { idempotencyKey: string }) =>
      callApi(createWork, {
        params: { workspaceId },
        body: {
          title,
          packageVersion,
          ...(documentIds?.length && { documentIds }),
        },
        idempotencyKey,
      }),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: workKeys.list(workspaceId) }),
  });
}

export function useAttachWorkDocuments(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      workId,
      documentIds,
    }: {
      workId: string;
      documentIds: string[];
    }) =>
      callApi(attachWorkDocuments, {
        params: { workspaceId, workId },
        body: { documentIds },
      }),
    onSuccess: (_, { workId }) => invalidateWork(client, workspaceId, workId),
  });
}

export function useDeleteWork(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (workId: string) =>
      callApi(deleteWork, { params: { workspaceId, workId } }),
    onSuccess: (status, workId) => {
      client.setQueryData(workKeys.deletion(workspaceId, workId), status);
      return invalidateWork(client, workspaceId, workId);
    },
  });
}

export function useAnalyzeWork(workspaceId: string, workId: string) {
  const client = useQueryClient();
  const key = useIdempotencyKey();
  return useMutation({
    mutationFn: () =>
      withIdempotencyKey(key, (idempotencyKey) =>
        callApi(analyzeWork, {
          params: { workspaceId, workId },
          idempotencyKey,
        }),
      ),
    onSuccess: () => invalidateWork(client, workspaceId, workId),
  });
}

export function useConfirmWork(workspaceId: string, workId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ revision }: { revision: number }) =>
      callApi(confirmWork, {
        params: { workspaceId, workId },
        body: { revision },
      }),
    onSuccess: () => invalidateWork(client, workspaceId, workId),
  });
}

// Ответ сохранения — уже новый вид работы: кэш берёт его сразу, не дожидаясь перезагрузки. Иначе форма
// сведений на короткое время увидит старые значения как серверные и откатит сохранённые.
export function useSaveFacts(workspaceId: string, workId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (draft: FactsDraft) =>
      callApi(editWork, { params: { workspaceId, workId }, body: draft }),
    onSuccess: async (saved) => {
      client.setQueryData(workKeys.detail(workspaceId, workId), saved);
      await invalidateWork(client, workspaceId, workId);
    },
  });
}
