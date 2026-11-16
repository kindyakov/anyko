// Ключи данных рабочей области начинаются с имени сущности и идентификатора области:
// смена области не получает кэш другой области, а инвалидация по префиксу затрагивает только свою.
export const workKeys = {
  all: (workspaceId: string) => ['works', workspaceId] as const,
  list: (workspaceId: string) =>
    [...workKeys.all(workspaceId), 'list'] as const,
  detail: (workspaceId: string, id: string) =>
    [...workKeys.all(workspaceId), 'detail', id] as const,
};

export const documentPackageKeys = {
  all: (workspaceId: string) => ['document-packages', workspaceId] as const,
  list: (workspaceId: string) =>
    [...documentPackageKeys.all(workspaceId), 'list'] as const,
};
