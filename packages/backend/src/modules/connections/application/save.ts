import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';
import type { AuditModule } from '../../audit';

import type { LlmSettingsStore } from './ports';
export interface LlmSettingsInput {
  baseURL: string;
  visionModel: string;
  extractionModel: string;
  apiKey?: string | undefined;
}
export async function persistConnection(
  deps: { store: LlmSettingsStore; audit: Pick<AuditModule, 'commands'> },
  workspaceId: string,
  input: LlmSettingsInput,
  actorId: string | null,
) {
  const revision = await deps.store.save(workspaceId, input);
  await deps.audit.commands.record({
    workspaceId,
    actorId,
    action: 'connections.settings_saved',
    target: { kind: 'workspace', id: workspaceId },
    data: { revision },
  });
}
export const saveConnection =
  (deps: { store: LlmSettingsStore; audit: Pick<AuditModule, 'commands'> }) =>
  (scope: WorkspaceScope, input: LlmSettingsInput) => {
    scope.require('connections.manage');
    return persistConnection(deps, scope.workspaceId, input, scope.userId);
  };
