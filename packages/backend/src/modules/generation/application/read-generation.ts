import type { GenerationStore } from '..';
import type { GenerationId, WorkId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

// Результат генерации работы. Внутренний запрос: сценарий скачивания проверяет право.
export const readGeneration =
  (deps: { store: GenerationStore }) =>
  (scope: WorkspaceScope, workId: WorkId, generationId: GenerationId) =>
    deps.store.get(scope.workspaceId, workId, generationId);
