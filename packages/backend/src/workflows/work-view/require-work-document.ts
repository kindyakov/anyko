import { WorkError, type WorksQueries } from '../../modules/works';
import type { DocumentId, WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';

export async function requireWorkDocument(
  works: WorksQueries,
  scope: WorkspaceScope,
  workId: WorkId,
  documentId: DocumentId,
) {
  scope.require('works.read');
  if (!(await works.hasActiveDocument(scope, workId, documentId)))
    throw new WorkError('NOT_FOUND');
  return { workspaceId: scope.workspaceId, documentId };
}
