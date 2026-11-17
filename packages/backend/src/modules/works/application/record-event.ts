import type { WorkEventKind, WorkStore } from '..';
import type { WorkId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

// Событие работы для потоков обновления. Внутренний шаг: сценарий уже проверил право.
export const recordEvent =
  (deps: { store: WorkStore }) =>
  async (
    scope: WorkspaceScope,
    input: { workId: WorkId; kind: WorkEventKind },
  ) => {
    await deps.store.event(scope.workspaceId, input.workId, input.kind);
  };
