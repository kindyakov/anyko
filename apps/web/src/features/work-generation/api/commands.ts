import { useMutation, useQueryClient } from '@tanstack/react-query';

import { generateWork } from '@anyko/contracts/works';

import { invalidateWork } from '@/features/works';
import { callApi } from '@/lib/api/call';

// Запуск формирования комплекта на указанной ревизии сведений: сервер отвечает постановкой в очередь.
export function useGenerateWork(workspaceId: string, workId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      revision,
      idempotencyKey,
    }: {
      revision: number;
      idempotencyKey: string;
    }) =>
      callApi(generateWork, {
        params: { workspaceId, workId },
        body: { revision },
        idempotencyKey,
      }),
    onSuccess: () => invalidateWork(client, workspaceId, workId),
  });
}
