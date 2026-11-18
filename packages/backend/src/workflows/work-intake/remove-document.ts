import type { DocumentsModule, ResourceLocks } from '../../modules/documents';
import type { WorksModule } from '../../modules/works';
import type { DocumentId, WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import {
  requireRemovalSource,
  workCommandPolicy,
  workCommandSources,
} from '../work-command-guards';
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
    scope.require(workCommandPolicy.remove.right);
    return deps.locks.run(
      workLockKey(scope.workspaceId, input.workId),
      async () => {
        await requireWork(deps.works.queries, scope, input.workId);
        const documents = workCommandSources(
          'remove',
          await deps.works.queries.sources(scope, input.workId),
        );
        requireRemovalSource(documents, input.documentId);
        await deps.documents.internal.commands.remove({
          workspaceId: scope.workspaceId,
          documentId: input.documentId,
          actorId: scope.userId,
        });
        await deps.works.internal.event(
          scope.workspaceId,
          input.workId,
          'sources.deleting',
        );
      },
    );
  };
