import type { DocumentId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';
import { DocumentError } from '../errors';

import type { DocumentDeps } from './ports';

export const readDeletionImpact =
  (deps: Pick<DocumentDeps, 'store'>) =>
  async (scope: WorkspaceScope, documentId: DocumentId) => {
    scope.require('recognitions.use');
    const impact = await deps.store.deletionImpact(
      scope.workspaceId,
      documentId,
    );
    if (!impact) throw new DocumentError('NOT_FOUND');
    if (impact.works.length) scope.require('works.read');
    return {
      ...impact,
      canDelete: !impact.works.length || scope.has('documents.deleteLinked'),
    };
  };
