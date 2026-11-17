import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

import type { DocumentDeps } from './ports';

// Список распознавания рабочей области: только неудалённые документы.
export const listDocuments =
  (deps: Pick<DocumentDeps, 'store'>) => async (scope: WorkspaceScope) => {
    scope.require('recognitions.use');
    return deps.store.list(scope.workspaceId);
  };
