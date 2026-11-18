import { useMutation, useQueryClient } from '@tanstack/react-query';

import { generateWork } from '@anyko/contracts/works';

import { callApi } from '@/lib/api/call';
import { useIdempotencyKey, withIdempotencyKey } from '@/lib/api/idempotency';

import { invalidateWork } from './mutations';

// Запуск формирования комплекта на указанной ревизии сведений: сервер отвечает постановкой в очередь.
export function useGenerateWork(workspaceId: string, workId: string) {
  const client = useQueryClient();
  const key = useIdempotencyKey();
  return useMutation({
    mutationFn: (revision: number) =>
      withIdempotencyKey(key, (idempotencyKey) =>
        callApi(generateWork, {
          params: { workspaceId, workId },
          body: { revision },
          idempotencyKey,
        }),
      ),
    onSuccess: () => invalidateWork(client, workspaceId, workId),
  });
}
