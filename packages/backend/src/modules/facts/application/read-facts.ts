import type { FactsStore } from '..';
import type { WorkId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

// Сведения работы. Внутренний запрос: сценарий, который его вызывает, проверяет право.
export const readFacts =
  (deps: { store: FactsStore }) => (scope: WorkspaceScope, workId: WorkId) =>
    deps.store.get(scope.workspaceId, workId);
