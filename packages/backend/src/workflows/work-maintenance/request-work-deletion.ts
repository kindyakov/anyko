import type { AuditModule } from '../../modules/audit';
import type { ResourceLocks } from '../../modules/documents';
import type { ProcessingModule } from '../../modules/processing';
import { WorkError, type WorksModule } from '../../modules/works';
import type { Clock } from '../../platform/clock';
import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { Tx, UnitOfWork } from '../../platform/transactions';
import { requireWork, workLockKey } from '../work-guards';

export function createWorkDeletionApi(deps: {
  works: WorksModule;
  processing: ProcessingModule;
  locks: ResourceLocks;
  uow: UnitOfWork;
  clock: Clock;
  audit: AuditModule;
  redactResponses(
    tx: Tx,
    workspaceId: string,
    workId: string,
    documentIds: string[],
  ): Promise<void>;
}) {
  return {
    async request(
      scope: WorkspaceScope,
      workId: WorkId,
      correlationId: string,
    ) {
      scope.require('works.delete');
      const { workspaceId } = scope;
      return deps.locks.run(workLockKey(workspaceId, workId), () =>
        deps.uow.run(async (tx) => {
          const work = deps.works.in(tx);
          const existing = await work.internal.deletion(workspaceId, workId);
          if (existing)
            return {
              status: existing.completedAt
                ? ('deleted' as const)
                : ('deleting' as const),
            };
          await requireWork(work.queries, scope, workId);
          const documents = await work.internal.documents(workspaceId, workId);
          await deps.processing.in(tx).internal.cancel(workspaceId, workId);
          await work.internal.requestDeletion(
            workspaceId,
            workId,
            [],
            deps.clock.now(),
          );
          await deps.redactResponses(
            tx,
            workspaceId,
            workId,
            documents.filter(({ uploaded }) => uploaded).map(({ id }) => id),
          );
          await deps.audit.in(tx).commands.record({
            workspaceId,
            actorId: scope.userId,
            action: 'works.deletion_requested',
            target: { kind: 'work', id: workId },
            correlationId,
          });
          await work.internal.event(workspaceId, workId, 'work.deleting');
          return { status: 'deleting' as const };
        }),
      );
    },
    async status(scope: WorkspaceScope, workId: WorkId) {
      scope.require('works.delete');
      const row = await deps.works.internal.deletion(scope.workspaceId, workId);
      if (!row) throw new WorkError('NOT_FOUND');
      return {
        status: row.completedAt
          ? ('deleted' as const)
          : row.failedAt
            ? ('needs-recovery' as const)
            : ('deleting' as const),
      };
    },
    async pending(scope: WorkspaceScope) {
      if (!scope.has('works.delete')) return [];
      const rows = await deps.works.internal.pendingDeletions(
        scope.workspaceId,
      );
      return rows.map(({ id, failedAt }) => ({
        id,
        status: failedAt ? ('needs-recovery' as const) : ('deleting' as const),
      }));
    },
  };
}
export type WorkDeletionApi = ReturnType<typeof createWorkDeletionApi>;
