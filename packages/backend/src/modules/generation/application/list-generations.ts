import type { GenerationStore } from '..';
import type { WorkId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

// Последние результаты работы для представления. Внутренний запрос.
export const listGenerations =
  (deps: { store: GenerationStore }) =>
  (scope: WorkspaceScope, workId: WorkId) =>
    deps.store.list(scope.workspaceId, workId);
