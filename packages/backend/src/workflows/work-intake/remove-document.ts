import { WorkError } from '../../modules/works';
import type { DocumentId, WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import { changeWork } from '../change-work';
import { workCommandPolicy } from '../work-command-guards';
import { requireWorkDocument } from '../work-view/require-work-document';

import type { WorkIntakeDeps } from './deps';

export const removeDocument =
  (
    deps: Pick<
      WorkIntakeDeps,
      'works' | 'locks' | 'processing' | 'uow' | 'redactWorkUploadResponses'
    >,
  ) =>
  async (
    scope: WorkspaceScope,
    { workId, documentId }: { workId: WorkId; documentId: DocumentId },
  ) => {
    scope.require(workCommandPolicy.remove.right);
    await changeWork(
      deps,
      scope,
      {
        workId,
        command: 'remove',
        event: 'sources.deleting',
      },
      async () => {
        const source = await requireWorkDocument(
          deps.works.queries,
          scope,
          workId,
          documentId,
        );
        return async (tx) => {
          if (
            !(await deps.works
              .in(tx)
              .internal.removeSource(scope.workspaceId, workId, documentId))
          )
            throw new WorkError('NOT_FOUND');
          if (source.uploaded)
            await deps.redactWorkUploadResponses(tx, scope.workspaceId, [
              documentId,
            ]);
        };
      },
    );
  };
