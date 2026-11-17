import type { WorkProcessingStore } from '..';
import type { WorkId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

// Есть ли у работы запуск в очереди или в исполнении. Внутренний запрос.
export const isActive =
  (deps: { store: WorkProcessingStore }) =>
  (scope: WorkspaceScope, workId: WorkId) =>
    deps.store.active(scope.workspaceId, workId);
