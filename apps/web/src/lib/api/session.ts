import { queryOptions } from '@tanstack/react-query';

import { getSession } from '@anyko/contracts/session';

import { callApi } from '@/lib/api/call';
import { ApiError } from '@/lib/api/errors';

export const sessionKeys = {
  all: ['session'] as const,
};

export function sessionQueryOptions() {
  return queryOptions({
    queryKey: sessionKeys.all,
    queryFn: async ({ signal }) => {
      try {
        return await callApi(getSession, { signal });
      } catch (error) {
        // Отсутствие сессии — обычный ответ для экрана входа, а не истечение сессии.
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    refetchOnWindowFocus: false,
  });
}
