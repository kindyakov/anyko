// Ключи данных рабочей области начинаются с имени сущности и идентификатора области.
export const documentKeys = {
  all: (workspaceId: string) => ['documents', workspaceId] as const,
  result: (workspaceId: string, id: string) =>
    [...documentKeys.all(workspaceId), 'result', id] as const,
};
