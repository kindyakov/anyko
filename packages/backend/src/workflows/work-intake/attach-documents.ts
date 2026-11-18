import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import { changeWork } from '../change-work';

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
    await changeWork(
      deps,
      scope,
      {
        workId,
        command: 'attach',
        event: 'documents.changed',
        sourceChange: true,
      },
      ({ documents }) => {
        const existing = new Set(documents.map(({ id }) => id));
        if (documentIds.every((id) => existing.has(id))) return;
        return async (tx, lockRevision) => {
          const selected = await resolveCatalogSelection(
            deps,
            tx,
            workspaceId,
            documentIds,
            existing,
          );
          await lockRevision();
          await deps.works
            .in(tx)
            .commands.attachDocuments(scope, { workId, documents: selected });
          return { confirmed: false };
        };
      },
    );
  };
