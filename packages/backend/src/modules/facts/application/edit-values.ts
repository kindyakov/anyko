import type { FactsStore, FieldValues } from '..';
import type { WorkId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';
import type { FieldDefinition } from '../../../profiles/fields';
import { editFacts } from '../domain/values';

// Ручная правка значений: поля, изменённые юристом, помечаются как ручные (правила в editFacts).
export const editValues =
  (deps: { store: FactsStore }) =>
  async (
    scope: WorkspaceScope,
    input: {
      workId: WorkId;
      values: Partial<FieldValues>;
      fields: readonly FieldDefinition[];
    },
  ) => {
    scope.require('works.edit');
    const current = await deps.store.get(scope.workspaceId, input.workId);
    const next = editFacts(current, input.values, input.fields);
    await deps.store.save(scope.workspaceId, input.workId, next);
    return { before: current.values, after: next.values };
  };
