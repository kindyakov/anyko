import type { DocumentsModule, ResourceLocks } from '../../modules/documents';
import { WorkError, type WorksModule } from '../../modules/works';
import type { DocumentId, WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import { requireWork, workLockKey } from '../work-guards';

// Удаление исходника работы: сначала доступ и принадлежность, затем удаление и событие.
export const removeDocument =
  (deps: {
    works: WorksModule;
    documents: DocumentsModule;
    locks: ResourceLocks;
  }) =>
  async (
    scope: WorkspaceScope,
    input: { workId: WorkId; documentId: DocumentId },
  ) => {
    scope.require('documents.delete');
    return deps.locks.run(
      workLockKey(scope.workspaceId, input.workId),
      async () => {
        await requireWork(deps.works.queries, scope, input.workId);
        const { documents } = await deps.works.queries.sources(
          scope,
          input.workId,
        );
        if (!documents.some((doc) => doc.id === input.documentId))
          throw new WorkError('NOT_FOUND');
        await deps.documents.internal.commands.remove({
          workspaceId: scope.workspaceId,
          documentId: input.documentId,
          actorId: scope.userId,
        });
        await deps.works.commands.recordEvent(scope, {
          workId: input.workId,
          kind: 'sources.deleting',
        });
      },
    );
  };
