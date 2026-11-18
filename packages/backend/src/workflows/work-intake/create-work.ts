import type { WorkspaceScope } from '../../platform/scope/workspace-scope';

import {
  requireCatalogSelection,
  resolveCatalogSelection,
} from './catalog-selection';
import type { WorkIntakeDeps } from './deps';

// Создание работы вместе с её сессией: одна транзакция, без внешних вызовов.
export const createWork =
  (
    deps: Pick<
      WorkIntakeDeps,
      'uow' | 'works' | 'agents' | 'lockDocumentRevisions'
    >,
  ) =>
  async (
    scope: WorkspaceScope,
    {
      documentIds,
      ...input
    }: {
      title: string;
      packageVersion: string;
      documentIds?: string[] | undefined;
    },
  ) => {
    scope.require('works.create');
    if (documentIds?.length) requireCatalogSelection(scope);
    return deps.uow.run(async (tx) => {
      const { commands } = deps.works.in(tx);
      const workId = await commands.create(scope, input);
      if (documentIds?.length) {
        const documents = await resolveCatalogSelection(
          deps,
          tx,
          scope.workspaceId,
          documentIds,
          new Set(),
        );
        await commands.attachDocuments(scope, { workId, documents });
      }
      await deps.agents.in(tx).internal.ensure(scope.workspaceId, workId);
      return workId;
    });
  };
