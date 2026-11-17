'use client';
import { useQuery } from '@tanstack/react-query';

import { ApiError, isUnauthorized } from '@/lib/api/errors';

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
  const query = useQuery(workQueryOptions(workspaceId, workId));
  const view = query.data;
  const live = useWorkEvents(workspaceId, workId, view?.cursor);
  return {
    view,
    loadError: loadErrorText(query.error),
    live,
    refetch: query.refetch,
  };
}

// 401 не показывается: сессия истекла, оболочка перенаправит на вход.
function loadErrorText(error: unknown): string {
  if (!error || isUnauthorized(error)) return '';
  return error instanceof ApiError && error.status === 404
    ? 'Работа не найдена.'
    : 'Не удалось обновить работу. Повторите попытку.';
}
