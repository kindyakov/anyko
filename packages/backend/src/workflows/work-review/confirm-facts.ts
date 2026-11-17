import type { ResourceLocks } from '../../modules/documents';
import type { FactsModule } from '../../modules/facts';
import type { ProcessingModule } from '../../modules/processing';
import type { WorksModule } from '../../modules/works';
import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { UnitOfWork } from '../../platform/transactions';
import { requireIdle, requireRevision, workLockKey } from '../work-guards';

// Подтверждение сведений по ожидаемой ревизии, когда у работы нет активного запуска.
export const confirmFacts =
  (deps: {
    uow: UnitOfWork;
    works: WorksModule;
    facts: FactsModule;
    processing: ProcessingModule;
    locks: ResourceLocks;
  }) =>
  async (
    scope: WorkspaceScope,
    input: { workId: WorkId; revision: number },
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
        await requireIdle(deps.processing.queries, scope, input.workId);
        await deps.uow.run(async (tx) => {
          await deps.facts
            .in(tx)
            .commands.confirm(scope, { workId: input.workId });
          await deps.works.in(tx).commands.bumpRevision(scope, {
            workId: input.workId,
            confirmed: true,
          });
          await deps.works.in(tx).commands.recordEvent(scope, {
            workId: input.workId,
            kind: 'facts.confirmed',
          });
        });
      },
    );
  };
