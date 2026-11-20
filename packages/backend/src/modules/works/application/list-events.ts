import { WorkError, type WorkStore } from '..';
import type { WorkId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

// События работы после курсора. Курсор — неотрицательное целое из цифр, иначе вход неверен.
export const listEvents =
  (deps: { store: WorkStore }) =>
  async (scope: WorkspaceScope, workId: WorkId, after: string) => {
    scope.require('works.read');
    if (!(await deps.store.get(scope.workspaceId, workId)))
      throw new WorkError('NOT_FOUND');
    if (!/^\d{1,30}$/.test(after)) throw new WorkError('INVALID_WORK_INPUT');
    return deps.store.events(scope.workspaceId, workId, after);
  };
