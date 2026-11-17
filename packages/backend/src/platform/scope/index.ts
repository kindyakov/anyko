// Публичный вход для потребителей (HTTP, тесты): типы и каталог прав. Выдача scope — в issue.ts,
// которую импортирует только modules/access.
export { type Right, rightCatalog } from './rights';
export type { WorkspaceScope } from './workspace-scope';
