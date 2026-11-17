import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

import type { LlmSettingsStore } from './ports';
export const currentConnection =
  (deps: { store: LlmSettingsStore }) => async (scope: WorkspaceScope) => {
    scope.require('connections.read');
    return {
      settings: await deps.store.current(scope.workspaceId),
      canManage: scope.has('connections.manage'),
    };
  };
