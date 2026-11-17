import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';

import type { Membership, Right } from '@anyko/contracts/session';

import { sessionQueryOptions } from '@/lib/api/session';

// Идентификатор рабочей области берётся из адреса /w/[workspace]. Право на область проверяет API;
// сегмент адреса только задаёт ключи кэша и пути запросов. Вне маршрута области хук бросает ошибку.
export function useWorkspaceId(): string {
  const { workspace } = useParams<{ workspace?: string }>();
  if (!workspace)
    throw new Error(
      'Рабочая область доступна только внутри адреса /w/[workspace]',
    );
  return workspace;
}

// Участие текущей области из кэша сессии. Layout рабочей области проверяет, что область адреса
// есть среди участий, поэтому отсутствие участия здесь — нарушение этого инварианта.
export function useMembership(): Membership {
  const workspace = useWorkspaceId();
  const session = useQuery(sessionQueryOptions()).data;
  const membership = session?.memberships.find(
    (item) => item.workspace.id === workspace,
  );
  if (!membership)
    throw new Error('Рабочая область адреса не входит в участия сессии');
  return membership;
}

// Право только для отображения: скрыть или заблокировать действие. Решение о доступе принимает API,
// а ответ с ошибкой 403 показывает форма или экран, как и для любого другого отказа.
export function useCan(right: Right): boolean {
  return useMembership().rights.includes(right);
}
