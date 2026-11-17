import type { DocumentId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';
import { DocumentError } from '../errors';

import type { DocumentDeps, DocumentView } from './ports';

// Повтор распознавания неуспешного документа: новая попытка ставится в очередь, старая не возвращается.
export const retryDocument = (deps: Pick<DocumentDeps, 'store'>) => {
  const internal = async (input: {
    workspaceId: string;
    documentId: string;
    actorId: string;
    correlationId: string;
  }): Promise<DocumentView> => {
    const result = await deps.store.retry(
      input.workspaceId,
      input.documentId,
      input.actorId,
      input.correlationId,
    );
    if (!result) throw new DocumentError('RETRY_CONFLICT');
    return result;
  };
  return {
    internal,
    recognition: async (
      scope: WorkspaceScope,
      documentId: DocumentId,
      correlationId: string,
    ) => {
      scope.require('recognitions.use');
      return internal({
        workspaceId: scope.workspaceId,
        documentId,
        actorId: scope.userId,
        correlationId,
      });
    },
  };
};
