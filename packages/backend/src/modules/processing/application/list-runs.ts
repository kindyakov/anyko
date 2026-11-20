import type { WorkId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

import type { WorkProcessingStore } from './work-ports';

// Последние запуски работы для представления. Внутренний запрос.
export const listRuns =
  (deps: { store: WorkProcessingStore }) =>
  (scope: WorkspaceScope, workId: WorkId) =>
    deps.store.list(scope.workspaceId, workId);
