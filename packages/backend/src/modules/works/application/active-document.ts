import type { WorkStore } from '..';
import type { DocumentId, WorkId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

export const activeDocument =
  (deps: { store: WorkStore }) =>
  (scope: WorkspaceScope, workId: WorkId, documentId: DocumentId) =>
    deps.store.activeDocument(scope.workspaceId, workId, documentId);
