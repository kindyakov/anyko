import type { WorkProcessingStore } from '..';
import type { WorkId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

// Последние запуски работы для представления. Внутренний запрос.
export const listRuns =
  (deps: { store: WorkProcessingStore }) =>
  (scope: WorkspaceScope, workId: WorkId) =>
    deps.store.list(scope.workspaceId, workId);
