import type { FactsStore } from '..';
import type { WorkId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';
import type { FieldDefinition } from '../../../profiles/fields';
import { packageFacts } from '../domain/values';

// Сведения работы. Внутренний запрос: сценарий, который его вызывает, проверяет право.
export const readFacts =
  (deps: { store: FactsStore }) =>
  async (
    scope: WorkspaceScope,
    workId: WorkId,
    fields: readonly FieldDefinition[],
  ) =>
    packageFacts(await deps.store.get(scope.workspaceId, workId), fields);
