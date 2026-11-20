import type { UserId, WorkspaceId } from '../ids';

import type { Right } from './rights';

declare const workspaceScopeBrand: unique symbol;

// Доверенная область запроса: пользователь, рабочая область и права его участия. Создаёт её только
// modules/access после проверки сессии и участия (правило backend-scope-issued-by-access).
// Каждая команда и запрос получают её первым аргументом; хранилища берут workspaceId из неё.
export interface WorkspaceScope {
  readonly [workspaceScopeBrand]: true;
  readonly userId: UserId;
  readonly workspaceId: WorkspaceId;
  readonly rights: readonly Right[];
  has(right: Right): boolean;
  // Бросает AppError с видом forbidden и кодом FORBIDDEN, если права нет.
  require(right: Right): void;
}
