import type { WorkStore } from '..';
import type { WorkId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

// Новая ревизия работы. Внутренний шаг: право проверяет сценарий правки или подтверждения.
export const bumpRevision =
  (deps: { store: WorkStore }) =>
  async (
    scope: WorkspaceScope,
    input: { workId: WorkId; confirmed: boolean },
  ) => {
    await deps.store.touch(
      scope.workspaceId,
      input.workId,
      input.confirmed ? { confirmed: true } : {},
    );
  };
