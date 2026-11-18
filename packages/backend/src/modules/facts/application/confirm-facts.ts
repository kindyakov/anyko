import type { FactsStore } from '..';
import type { WorkId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';
import { confirmFacts } from '../domain/values';

// Подтверждение всех сведений: выполняется сценарием правки после проверки ревизии.
export const confirmValues =
  (deps: { store: FactsStore }) =>
  async (scope: WorkspaceScope, input: { workId: WorkId }) => {
    scope.require('works.edit');
    await deps.store.save(
      scope.workspaceId,
      input.workId,
      confirmFacts(await deps.store.get(scope.workspaceId, input.workId)),
    );
  };
