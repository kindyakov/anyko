import { WorkError, type WorksQueries } from '../../modules/works';
import type { DocumentId, WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';

export async function requireWorkDocument(
  works: WorksQueries,
  scope: WorkspaceScope,
  workId: WorkId,
  documentId: DocumentId,
  revision?: number,
) {
  scope.require('works.read');
  const source = await works.activeDocument(scope, workId, documentId);
  if (!source) throw new WorkError('NOT_FOUND');
  if (revision !== undefined && source.ocrRevision !== revision)
    throw new WorkError('NOT_READY');
  return {
    workspaceId: scope.workspaceId,
    documentId,
    revision: source.ocrRevision,
    uploaded: source.uploaded,
  };
}
