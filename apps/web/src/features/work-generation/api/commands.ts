import { z } from 'zod';

import { requestApi } from '@/lib/api/client';

const accepted = z.object({ status: z.string() });

// Запуск формирования комплекта на указанной ревизии сведений: сервер отвечает постановкой в очередь.
export function generateWork(workId: string, revision: number) {
  return requestApi(`/works/${workId}/generate`, accepted, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ revision }),
  });
}
