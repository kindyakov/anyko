'use client';
import { skipToken, useQuery } from '@tanstack/react-query';

import { getWork } from '@anyko/contracts/works';

import { ApiError, describeApiError, isUnauthorized } from '@/lib/api/errors';

import { useWorkEvents } from './events';
import { workQueryOptions } from './queries';

// Вид работы — серверное состояние кэша; подписка на события только инвалидирует его.
export function useWorkView({
  workspaceId,
  workId,
}: {
  workspaceId: string;
  workId: string;
}) {
  const validId = getWork.params.shape.workId.safeParse(workId).success;
  const options = workQueryOptions(workspaceId, workId);
  const query = useQuery({
    ...options,
    queryFn: validId ? (options.queryFn ?? skipToken) : skipToken,
  });
  const view = validId ? query.data : undefined;
  const live = useWorkEvents(workspaceId, workId, view?.cursor);
  return {
    view,
    loadError: validId ? loadErrorText(query.error) : 'Работа не найдена.',
    canRetry: validId,
    live,
    refetch: query.refetch,
  };
}

// 401 не показывается: сессия истекла, оболочка перенаправит на вход.
function loadErrorText(error: unknown): string {
  if (!error || isUnauthorized(error)) return '';
  if (error instanceof ApiError && error.status === 404)
    return 'Работа не найдена.';
  const message = 'Не удалось открыть карточку работы. Повторите попытку.';
  return describeApiError(error, { technical: message, fallback: message });
}
