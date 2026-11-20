import type { WorkIoPort, WorkStore } from '..';
import type { WorkId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

// Исходники работы и готовность к изменениям. Внутренний запрос: сценарий решает, что делать с ответом.
export const readSources =
  (deps: { store: WorkStore; io: WorkIoPort }) =>
  async (scope: WorkspaceScope, workId: WorkId) => {
    const documents = await deps.store.documents(scope.workspaceId, workId);
    const cleanupPending =
      documents.some((row) => row.deleted) ||
      !(await deps.io.clean(scope.workspaceId, workId));
    return { documents, cleanupPending };
  };
