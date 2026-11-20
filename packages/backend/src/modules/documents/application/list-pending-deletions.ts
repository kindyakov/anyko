import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

import type { DocumentDeps } from './ports';

// Незавершённые удаления: видно, что документ ещё удаляется или требует ручного восстановления.
export const listPendingDeletions =
  (deps: Pick<DocumentDeps, 'store'>) => async (scope: WorkspaceScope) => {
    scope.require('recognitions.use');
    return deps.store.pendingDeletions(scope.workspaceId);
  };
