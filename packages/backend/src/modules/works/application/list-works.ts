import { WorkError, type WorkStore } from '..';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

const pageSize = 50;

// Список работ по курсору. Неизвестный курсор — не найдено, как и для одной работы.
export const listWorks =
  (deps: { store: WorkStore }) =>
  async (scope: WorkspaceScope, after?: string) => {
    scope.require('works.read');
    if (after && !(await deps.store.get(scope.workspaceId, after)))
      throw new WorkError('NOT_FOUND');
    const rows = await deps.store.list(scope.workspaceId, after);
    const works = rows.slice(0, pageSize);
    return {
      works,
      nextCursor: rows.length > pageSize ? (works.at(-1)?.id ?? null) : null,
    };
  };
