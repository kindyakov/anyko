import type { WorkId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

import type { WorkProcessingStore } from './work-ports';

// Есть ли у работы запуск в очереди или в исполнении. Внутренний запрос.
export const isActive =
  (deps: { store: WorkProcessingStore }) =>
  (scope: WorkspaceScope, workId: WorkId, kind?: 'chat') =>
    deps.store.active(scope.workspaceId, workId, kind);
