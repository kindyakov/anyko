import type { WorkStore } from '..';
import type { WorkId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

// Работа в доверенной области или null. Внутренний запрос: право проверяет вызывающий сценарий.
export const findWork =
  (deps: { store: WorkStore }) => (scope: WorkspaceScope, workId: WorkId) =>
    deps.store.get(scope.workspaceId, workId);
