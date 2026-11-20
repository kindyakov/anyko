import type { ResourceLocks } from '../../modules/documents';
import type { FactsModule } from '../../modules/facts';
import type { ProcessingModule } from '../../modules/processing';
import type { WorksModule } from '../../modules/works';
import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { UnitOfWork } from '../../platform/transactions';
import { changeWork } from '../change-work';
import { workCommandPolicy } from '../work-command-guards';

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
    scope.require(workCommandPolicy.confirm.right);
    await changeWork(
      deps,
      scope,
      {
        workId: input.workId,
        expectedRevision: input.revision,
        command: 'confirm',
        advance: 'confirmed',
        event: 'facts.confirmed',
      },
      () => (tx) =>
        deps.facts.in(tx).commands.confirm(scope, { workId: input.workId }),
    );
  };
