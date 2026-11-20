import type { DocumentId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';
import { DocumentError } from '../errors';

import type { DocumentDeletionConfirmation, DocumentDeps } from './ports';

// Удаление документа: tombstone, отмена запусков и запись журнала — в одной транзакции хранилища.
export const removeDocument = (deps: Pick<DocumentDeps, 'store'>) => {
  const internal = async (input: {
    workspaceId: string;
    documentId: string;
    actorId: string;
    confirmation?: DocumentDeletionConfirmation;
  }) => {
    if (
      !(await deps.store.remove(
        input.workspaceId,
        input.documentId,
        input.actorId,
        input.confirmation,
      ))
    )
      throw new DocumentError('NOT_FOUND');
  };
  return {
    internal,
    recognition: async (
      scope: WorkspaceScope,
      documentId: DocumentId,
      token?: string,
    ) => {
      scope.require('recognitions.use');
      return internal({
        workspaceId: scope.workspaceId,
        documentId,
        actorId: scope.userId,
        confirmation: {
          token,
          canDeleteLinked: scope.has('documents.deleteLinked'),
        },
      });
    },
  };
};
