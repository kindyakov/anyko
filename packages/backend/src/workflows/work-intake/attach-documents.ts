import { WorkError } from '../../modules/works';
import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import { requireIdle, requireWork, workLockKey } from '../work-guards';

import type { WorkIntakeDeps } from './deps';

export const workSourceLimit = 20;

export const attachDocuments =
  (
    deps: Pick<
      WorkIntakeDeps,
      'uow' | 'works' | 'locks' | 'processing' | 'lockDocumentRevisions'
    >,
  ) =>
  async (
    scope: WorkspaceScope,
    { workId, documentIds }: { workId: WorkId; documentIds: string[] },
  ) => {
    scope.require('documents.upload');
    scope.require('recognitions.use');
    const { workspaceId } = scope;
    await deps.locks.run(workLockKey(workspaceId, workId), () =>
      deps.uow.run(async (tx) => {
        const work = deps.works.in(tx);
        await requireWork(work.queries, scope, workId);
        const previous = await work.queries.sources(scope, workId);
        const existing = new Set(
          previous.documents
            .filter(({ deleted }) => !deleted)
            .map(({ id }) => id),
        );
        const requested = [
          ...new Set(documentIds.filter((id) => !existing.has(id))),
        ];
        if (!requested.length) return;
        if (previous.cleanupPending) throw new WorkError('CLEANUP_PENDING');
        if (existing.size + requested.length > workSourceLimit)
          throw new WorkError('INVALID_WORK_INPUT');
        await requireIdle(deps.processing.in(tx).queries, scope, workId);
        const selected = await deps.lockDocumentRevisions(
          tx,
          workspaceId,
          requested,
        );
        const ready = new Set(
          selected.filter((doc) => doc.revision !== null).map(({ id }) => id),
        );
        const fields = documentIds.flatMap((id, index) =>
          existing.has(id) || ready.has(id)
            ? []
            : [
                {
                  path: ['documentIds', index],
                  code: 'invalid_value' as const,
                },
              ],
        );
        if (fields.length) throw new WorkError('NOT_READY', { fields });
        await work.commands.attachDocuments(scope, {
          workId,
          documents: selected,
        });
      }),
    );
  };
