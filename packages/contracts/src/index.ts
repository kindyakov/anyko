// Временный корневой экспорт: web ещё импортирует `@anyko/contracts`. Удаляется в web #11,
// новый код импортирует subpath (`@anyko/contracts/works` и т. д.).
export * from './common';
export * from './catalog';
export * from './connections';
export * from './documents';
export * from './session';
// web до #11 читает прежнюю форму сессии `{ user, workspace }` по прежним именам.
export {
  type LegacySession as Session,
  legacySessionResponseSchema as sessionResponseSchema,
} from './session';
export * from './works';
