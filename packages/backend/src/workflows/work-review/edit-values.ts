import type { ResourceLocks } from '../../modules/documents';
import type { FactsModule, FieldValues } from '../../modules/facts';
import type { WorksModule } from '../../modules/works';
import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { UnitOfWork } from '../../platform/transactions';
import { requireRevision, workLockKey } from '../work-guards';

// Правка значений юристом по ожидаемой ревизии: сведения и ревизия работы меняются одной транзакцией.
export const editValues =
  (deps: {
    uow: UnitOfWork;
    works: WorksModule;
    facts: FactsModule;
    locks: ResourceLocks;
  }) =>
  async (
    scope: WorkspaceScope,
    input: { workId: WorkId; revision: number; values: FieldValues },
  ) => {
    scope.require('works.edit');
    await deps.locks.run(
      workLockKey(scope.workspaceId, input.workId),
      async () => {
        await requireRevision(
          deps.works.queries,
          scope,
          input.workId,
          input.revision,
        );
        await deps.uow.run(async (tx) => {
          await deps.facts.in(tx).commands.edit(scope, {
            workId: input.workId,
            values: input.values,
          });
          await deps.works.in(tx).commands.bumpRevision(scope, {
            workId: input.workId,
            confirmed: false,
          });
          await deps.works.in(tx).commands.recordEvent(scope, {
            workId: input.workId,
            kind: 'facts.changed',
          });
        });
      },
    );
  };
