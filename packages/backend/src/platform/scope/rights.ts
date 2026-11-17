// Каталог именованных прав (ADR 0009). Роли выдают права в access; сценарии проверяют права, а не роли.
// Тот же список объявлен в contracts/session: тест apps/api сверяет оба каталога.
export const rightCatalog = [
  'works.read',
  'works.create',
  'works.edit',
  'works.delete',
  'works.generate',
  'documents.upload',
  'documents.delete',
  'recognitions.use',
  'connections.read',
  'connections.manage',
  'members.invite',
] as const;

export type Right = (typeof rightCatalog)[number];
