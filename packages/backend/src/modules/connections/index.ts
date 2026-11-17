import type { Tx } from '../../platform/transactions';

import type { LlmConfiguration, LlmSettingsStore } from './application/ports';
import type { LlmSettingsInput } from './application/save';
export type { LlmConfiguration, LlmSettingsStore, LlmSettingsInput };
export { ConnectionErrors } from './errors';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
export interface ConnectionSettingsApi {
  current(
    scope: WorkspaceScope,
  ): Promise<{ settings: LlmConfiguration | null; canManage: boolean }>;
  save(scope: WorkspaceScope, input: LlmSettingsInput): Promise<void>;
  revoke(scope: WorkspaceScope): Promise<void>;
}
export interface ConnectionsPorts {
  commands: Pick<ConnectionSettingsApi, 'save' | 'revoke'>;
  queries: Pick<ConnectionSettingsApi, 'current'>;
  internal: {
    configuration(workspaceId: string): Promise<LlmConfiguration | null>;
    connection: LlmSettingsStore['connection'];
  };
}
export interface ConnectionsModule extends ConnectionsPorts {
  in(tx: Tx): ConnectionsPorts;
  provision(
    workspaceId: string,
    input: LlmSettingsInput,
  ): Promise<'configured' | 'already-configured'>;
}
