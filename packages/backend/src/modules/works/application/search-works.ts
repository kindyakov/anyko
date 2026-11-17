import type { WorkSearch, WorkStore } from '..';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

export const searchWorks =
  (deps: { store: WorkStore }) =>
  async (scope: WorkspaceScope, input: WorkSearch) => {
    scope.require('works.read');
    return deps.store.search(scope.workspaceId, input);
  };
