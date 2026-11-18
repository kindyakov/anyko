import type { DocumentsModule } from '../../modules/documents';
import type { WorksModule } from '../../modules/works';
import type { DocumentId, WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import { requireWork } from '../work-guards';

import { requireAttachedDocument } from './get-source';

// Изображение страницы исходного документа работы.
export const getImage =
  (deps: { works: WorksModule; documents: DocumentsModule }) =>
  async (
    scope: WorkspaceScope,
    workId: WorkId,
    documentId: DocumentId,
    index: number,
    revision?: number,
  ) => {
    scope.require('works.read');
    await requireWork(deps.works.queries, scope, workId);
    const source = await requireAttachedDocument(
      deps.works,
      scope,
      workId,
      documentId,
      revision,
    );
    return deps.documents.internal.queries.image({
      workspaceId: scope.workspaceId,
      documentId,
      revision: source.ocrRevision,
      index,
    });
  };
