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
      | 'works'
      | 'resolvePackage'
      | 'locks'
      | 'processing'
      | 'uow'
      | 'facts'
      | 'redactWorkUploadResponses'
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
      async ({ work }) => {
        const source = await requireWorkDocument(
          deps.works.queries,
          scope,
          workId,
          documentId,
        );
        return async (tx) => {
          const works = deps.works.in(tx).internal;
          if (
            await works.unlinkPendingUpload(
              scope.workspaceId,
              workId,
              documentId,
            )
          ) {
            // A source that never entered an analysis has no work artifacts to purge.
            await works.closeOpenUploadGroup(scope.workspaceId, workId);
            await works.touch(scope.workspaceId, workId, {
              expectedRevision: work.revision,
              inputChanged: true,
              confirmed: work.confirmedRevision === work.revision,
            });
          } else if (
            !(await works.removeSource(scope.workspaceId, workId, documentId))
          ) {
            throw new WorkError('NOT_FOUND');
          }
          await deps.facts
            .in(tx)
            .internal.removeSubmittedAttachment(
              scope.workspaceId,
              workId,
              documentId,
              deps.resolvePackage(work.packageVersion).description.fields,
            );
          if (source.uploaded)
            await deps.redactWorkUploadResponses(tx, scope.workspaceId, [
              documentId,
            ]);
        };
      },
    );
  };
