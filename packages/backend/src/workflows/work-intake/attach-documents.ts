import { WorkError } from '../../modules/works';
import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import { requireIdle, requireWork, workLockKey } from '../work-guards';

import {
  requireCatalogSelection,
  resolveCatalogSelection,
} from './catalog-selection';
import type { WorkIntakeDeps } from './deps';

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
    requireCatalogSelection(scope);
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
        if (documentIds.every((id) => existing.has(id))) return;
        if (previous.cleanupPending) throw new WorkError('CLEANUP_PENDING');
        await requireIdle(deps.processing.in(tx).queries, scope, workId);
        const selected = await resolveCatalogSelection(
          deps,
          tx,
          workspaceId,
          documentIds,
          existing,
        );
        await work.commands.attachDocuments(scope, {
          workId,
          documents: selected,
        });
      }),
    );
  };
