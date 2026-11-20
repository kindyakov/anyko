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
    return deps.store.attach(
      scope.workspaceId,
      input.workId,
      input.documents,
      scope.userId,
    );
  };
