import type { DocumentId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';
import { DocumentError } from '../errors';

import type { DocumentDeps, DocumentView } from './ports';

// Метаданные документа: без удалённых и чужих документов.
export const readDocument = (deps: Pick<DocumentDeps, 'store'>) => {
  const internal = async (input: {
    workspaceId: string;
    documentId: string;
  }): Promise<DocumentView> => {
    const found = await deps.store.get(input.workspaceId, input.documentId);
    if (!found) throw new DocumentError('NOT_FOUND');
    return found;
  };
  return {
    internal,
    recognition: async (scope: WorkspaceScope, documentId: DocumentId) => {
      scope.require('recognitions.use');
      return internal({ workspaceId: scope.workspaceId, documentId });
    },
  };
};
