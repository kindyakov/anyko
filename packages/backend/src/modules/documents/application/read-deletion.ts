import type { DocumentId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';
import { DocumentError } from '../errors';

import type { DocumentDeps } from './ports';

// Состояние удаления документа; без записи об удалении документ не существует.
export const readDeletion =
  (deps: Pick<DocumentDeps, 'store'>) =>
  async (scope: WorkspaceScope, documentId: DocumentId) => {
    scope.require('recognitions.use');
    const status = await deps.store.deletion(scope.workspaceId, documentId);
    if (!status) throw new DocumentError('NOT_FOUND');
    return { status };
  };

export const readDeletions =
  (deps: Pick<DocumentDeps, 'store'>) =>
  async (scope: WorkspaceScope, documentIds: DocumentId[]) => {
    scope.require('recognitions.use');
    const results = await deps.store.deletions(scope.workspaceId, documentIds);
    if (results.length !== documentIds.length)
      throw new DocumentError('NOT_FOUND');
    return results;
  };
