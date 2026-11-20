import type { AgentsModule } from '../../modules/agents';
import type { ResourceLocks } from '../../modules/documents';
import { WorkError, type WorksModule } from '../../modules/works';
import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import { requireCleanSources, requireWork, workLockKey } from '../work-guards';

export function agentHistoryQueries(deps: {
  agents: AgentsModule;
  works: WorksModule;
  locks: ResourceLocks;
}) {
  const authorized = <T>(
    scope: WorkspaceScope,
    workId: WorkId,
    read: () => Promise<T>,
  ) => {
    scope.require('works.read');
    return deps.locks.run(workLockKey(scope.workspaceId, workId), async () => {
      await requireWork(deps.works.queries, scope, workId);
      await requireCleanSources(deps.works.queries, scope, workId);
      return read();
    });
  };
  return {
    listAgentHistoryRuns: (
      scope: WorkspaceScope,
      workId: WorkId,
      page: number,
      pageSize: number,
    ) =>
      authorized(scope, workId, () =>
        deps.agents.internal.history.runs(
          { workspaceId: scope.workspaceId, workId },
          page,
          pageSize,
        ),
      ),
    agentHistory: (
      scope: WorkspaceScope,
      workId: WorkId,
      runId: string,
      page: number,
      pageSize: number,
    ) => {
      return authorized(scope, workId, async () => {
        const result = await deps.agents.internal.history.read(
          { workspaceId: scope.workspaceId, workId, runId },
          page,
          pageSize,
        );
        if (!result) throw new WorkError('NOT_FOUND');
        return result;
      });
    },
  };
}
