import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import type { FieldValues } from '@anyko/contracts/catalog';
import {
  analyzeWork,
  confirmWork,
  createWork,
  editWork,
} from '@anyko/contracts/works';

import { callApi } from '@/lib/api/call';

import { workKeys } from './keys';

// Несохранённые правки полей: значения и ревизия работы, на которой они начаты.
export type FactsDraft = { values: FieldValues; revision: number };

export type CreateWorkInput = { title: string; packageVersion: string };

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
      idempotencyKey,
    }: CreateWorkInput & { idempotencyKey: string }) =>
      callApi(createWork, {
        params: { workspaceId },
        body: { title, packageVersion },
        idempotencyKey,
      }),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: workKeys.list(workspaceId) }),
  });
}

export function useAnalyzeWork(workspaceId: string, workId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ idempotencyKey }: { idempotencyKey: string }) =>
      callApi(analyzeWork, {
        params: { workspaceId, workId },
        idempotencyKey,
      }),
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

export function useSaveFacts(workspaceId: string, workId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (draft: FactsDraft) =>
      callApi(editWork, { params: { workspaceId, workId }, body: draft }),
    onSuccess: () => invalidateWork(client, workspaceId, workId),
  });
}
