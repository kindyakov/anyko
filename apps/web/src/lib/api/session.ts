import { queryOptions } from '@tanstack/react-query';

import { sessionResponseSchema } from '@anyko/contracts';

import { requestApi } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';

export const sessionKeys = {
  all: ['session'] as const,
};

export function sessionQueryOptions() {
  return queryOptions({
    queryKey: sessionKeys.all,
    queryFn: async ({ signal }) => {
      try {
        return await requestApi('/session', sessionResponseSchema, { signal });
      } catch (error) {
        // Отсутствие сессии — обычный ответ для экрана входа, а не истечение сессии.
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    refetchOnWindowFocus: false,
  });
}
