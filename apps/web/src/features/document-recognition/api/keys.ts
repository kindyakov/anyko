// Ключи данных рабочей области начинаются с имени сущности и идентификатора области.
export const documentKeys = {
  all: (workspaceId: string) => ['documents', workspaceId] as const,
  list: (workspaceId: string) =>
    [...documentKeys.all(workspaceId), 'list'] as const,
  // Результат документа работы и распознавания читается разными адресами: владелец входит в ключ.
  result: (
    workspaceId: string,
    id: string,
    workId?: string,
    revision?: number,
  ) =>
    [
      ...documentKeys.all(workspaceId),
      'result',
      id,
      workId ?? null,
      revision ?? null,
    ] as const,
  source: (workspaceId: string, id: string, workId?: string) =>
    [...documentKeys.all(workspaceId), 'source', id, workId ?? null] as const,
};
