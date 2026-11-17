import type { DocumentService } from '../../modules/documents';
import type { WorksModule } from '../../modules/works';
import type { DocumentId, WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import { requireWork } from '../work-guards';

import { requireAttachedDocument } from './get-source';

// Изображение страницы исходного документа работы.
export const getImage =
  (deps: { works: WorksModule; documents: DocumentService }) =>
  async (
    scope: WorkspaceScope,
    workId: WorkId,
    documentId: DocumentId,
    index: number,
  ) => {
    scope.require('works.read');
    await requireWork(deps.works.queries, scope, workId);
    await requireAttachedDocument(deps.works, scope, workId, documentId);
    return deps.documents.image({
      workspaceId: scope.workspaceId,
      documentId,
      index,
    });
  };
