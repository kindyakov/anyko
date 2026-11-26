import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

import type { DocumentDeps, DocumentListInput, DocumentPage } from './ports';

export const listDocuments =
  (deps: Pick<DocumentDeps, 'store'>) =>
  async (
    scope: WorkspaceScope,
    input: DocumentListInput,
  ): Promise<DocumentPage> => {
    scope.require('recognitions.use');
    const { items, page, total } = await deps.store.list(
      scope.workspaceId,
      input,
    );
    const links =
      items.length && scope.has('works.read')
        ? await deps.store.linkedWorks(
            scope.workspaceId,
            items.map(({ id }) => id),
          )
        : undefined;
    return {
      items: links
        ? items.map((document) => ({
            ...document,
            linkedWorks: links.get(document.id) ?? [],
          }))
        : items,
      page,
      pageSize: input.pageSize,
      total,
    };
  };
