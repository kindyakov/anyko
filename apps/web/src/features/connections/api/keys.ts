// Ключи подключений начинаются с рабочей области: смена области не получает чужие настройки из кэша.
export const connectionKeys = {
  all: (workspaceId: string) => ['connections', workspaceId] as const,
  llm: (workspaceId: string) =>
    [...connectionKeys.all(workspaceId), 'llm'] as const,
};
