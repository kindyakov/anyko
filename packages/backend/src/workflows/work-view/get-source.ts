import type { DocumentsModule } from '../../modules/documents';
import { WorkError, type WorksModule } from '../../modules/works';
import type { DocumentId, WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import { requireWork } from '../work-guards';

// Исходный файл документа работы. Документ другой работы и удалённый документ не существуют.
export const getSource =
  (deps: { works: WorksModule; documents: DocumentsModule }) =>
  async (scope: WorkspaceScope, workId: WorkId, documentId: DocumentId) => {
    scope.require('works.read');
    await requireWork(deps.works.queries, scope, workId);
    await requireAttachedDocument(deps.works, scope, workId, documentId);
    return deps.documents.internal.queries.source({
      workspaceId: scope.workspaceId,
      documentId,
    });
  };

export async function requireAttachedDocument(
  works: WorksModule,
  scope: WorkspaceScope,
  workId: WorkId,
  documentId: DocumentId,
) {
  const { documents } = await works.queries.sources(scope, workId);
  const attached = documents.find(
    (doc) => doc.id === documentId && !doc.deleted,
  );
  if (!attached) throw new WorkError('NOT_FOUND');
  return attached;
}
