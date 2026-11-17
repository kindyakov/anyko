import type { WorkStore } from '..';
import type { DocumentId, WorkId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

// Привязка загруженного документа к работе. Повтор привязки того же документа ничего не меняет.
export const attachDocument =
  (deps: { store: WorkStore }) =>
  async (
    scope: WorkspaceScope,
    input: { workId: WorkId; documentId: DocumentId },
  ) => {
    scope.require('documents.upload');
    const linked = await deps.store.documents(scope.workspaceId, input.workId);
    if (linked.some((row) => row.id === input.documentId)) return;
    await deps.store.attach(scope.workspaceId, input.workId, input.documentId);
    await deps.store.touch(scope.workspaceId, input.workId, {
      inputChanged: true,
    });
    await deps.store.event(
      scope.workspaceId,
      input.workId,
      'documents.changed',
    );
  };
