import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/lib/api/errors';
import { sessionKeys } from '@/lib/api/session';

// Истечение сессии: отменяет запросы, сбрасывает сессию в null и удаляет остальные данные,
// чтобы следующий пользователь не увидел чужой кэш.
export function expireSession(client: QueryClient) {
  void client.cancelQueries();
  client.setQueryData(sessionKeys.all, null);
  client.removeQueries({
    predicate: (query) => query.queryKey[0] !== sessionKeys.all[0],
  });
  client.getMutationCache().clear();
}

function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

// 401 от любого запроса или команды обрабатывается здесь, один раз. Запрос сессии сам
// превращает 401 в null (см. sessionQueryOptions), поэтому цикла не возникает.
export function createQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: false },
      mutations: { retry: false },
    },
    queryCache: new QueryCache({
      onError: (error) => {
        if (isUnauthorized(error)) expireSession(client);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        if (isUnauthorized(error)) expireSession(client);
      },
    }),
  });
  return client;
}
