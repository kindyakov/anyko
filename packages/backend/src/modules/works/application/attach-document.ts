import type { WorkSourceAttachment, WorkStore } from '..';
import type { WorkId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

// Привязка загруженного документа к работе. Повтор привязки того же документа ничего не меняет.
export const attachDocuments =
  (deps: { store: WorkStore }) =>
  async (
    scope: WorkspaceScope,
    input: { workId: WorkId; documents: readonly WorkSourceAttachment[] },
  ) => {
    scope.require('documents.upload');
    const added = await deps.store.attach(
      scope.workspaceId,
      input.workId,
      input.documents,
    );
    if (!added) return;
    await deps.store.touch(scope.workspaceId, input.workId, {
      inputChanged: true,
    });
    await deps.store.event(
      scope.workspaceId,
      input.workId,
      'documents.changed',
    );
  };
