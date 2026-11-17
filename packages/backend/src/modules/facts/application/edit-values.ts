import { editFacts, type FactsStore, type FieldValues } from '..';
import type { WorkId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

// Ручная правка значений: поля, изменённые юристом, помечаются как ручные (правила в editFacts).
export const editValues =
  (deps: { store: FactsStore }) =>
  async (
    scope: WorkspaceScope,
    input: { workId: WorkId; values: FieldValues },
  ) => {
    scope.require('works.edit');
    const current = await deps.store.get(scope.workspaceId, input.workId);
    await deps.store.save(
      scope.workspaceId,
      input.workId,
      editFacts(current, input.values),
    );
  };
