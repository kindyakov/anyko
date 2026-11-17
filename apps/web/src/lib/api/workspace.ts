import { useParams } from 'next/navigation';

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
