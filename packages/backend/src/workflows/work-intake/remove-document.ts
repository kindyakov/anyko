import { WorkError } from '../../modules/works';
import type { DocumentId, WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import { requireWork, workLockKey } from '../work-guards';

import type { WorkIntakeDeps } from './deps';

// Удаление исходника работы: сначала доступ и принадлежность, затем удаление и событие.
export const removeDocument =
  (
    deps: Pick<
      WorkIntakeDeps,
      'works' | 'locks' | 'uow' | 'redactWorkUploadResponses'
    >,
  ) =>
  async (
    scope: WorkspaceScope,
    input: { workId: WorkId; documentId: DocumentId },
  ) => {
    scope.require('documents.delete');
    return deps.locks.run(workLockKey(scope.workspaceId, input.workId), () =>
      deps.uow.run(async (tx) => {
        const works = deps.works.in(tx);
        await requireWork(works.queries, scope, input.workId);
        const source = (
          await works.internal.documents(scope.workspaceId, input.workId)
        ).find((row) => row.id === input.documentId && !row.deleted);
        if (
          !source ||
          !(await works.internal.removeSource(
            scope.workspaceId,
            input.workId,
            input.documentId,
          ))
        )
          throw new WorkError('NOT_FOUND');
        if (source.uploaded)
          await deps.redactWorkUploadResponses(tx, scope.workspaceId, [
            source.id,
          ]);
        await works.commands.recordEvent(scope, {
          workId: input.workId,
          kind: 'sources.deleting',
        });
      }),
    );
  };
