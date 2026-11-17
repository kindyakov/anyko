import type { AgentsModule } from '../../modules/agents';
import type { WorksModule } from '../../modules/works';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { UnitOfWork } from '../../platform/transactions';

// Создание работы вместе с её сессией: одна транзакция, без внешних вызовов.
export const createWork =
  (deps: { uow: UnitOfWork; works: WorksModule; agents: AgentsModule }) =>
  async (
    scope: WorkspaceScope,
    input: { title: string; packageVersion: string },
  ) => {
    scope.require('works.create');
    return deps.uow.run(async (tx) => {
      const workId = await deps.works.in(tx).commands.create(scope, input);
      await deps.agents.in(tx).internal.ensure(scope.workspaceId, workId);
      return workId;
    });
  };
