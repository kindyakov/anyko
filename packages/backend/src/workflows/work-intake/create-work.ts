import type { WorksModule } from '../../modules/works';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { UnitOfWork } from '../../platform/transactions';

import type { WorkSessionPort } from './ports';

// Создание работы вместе с её сессией: одна транзакция, без внешних вызовов.
export const createWork =
  (deps: { uow: UnitOfWork; works: WorksModule; sessions: WorkSessionPort }) =>
  async (
    scope: WorkspaceScope,
    input: { title: string; packageVersion: string },
  ) => {
    scope.require('works.create');
    return deps.uow.run(async (tx) => {
      const workId = await deps.works.in(tx).commands.create(scope, input);
      await deps.sessions.in(tx).ensure(scope.workspaceId, workId);
      return workId;
    });
  };
