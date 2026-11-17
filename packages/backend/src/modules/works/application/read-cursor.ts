import type { WorkStore } from '..';
import type { WorkId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

// Курсор событий работы. Читается раньше данных: параллельные изменения придут повторно, но не пропадут.
export const readCursor =
  (deps: { store: WorkStore }) => (scope: WorkspaceScope, workId: WorkId) =>
    deps.store.cursor(scope.workspaceId, workId);
