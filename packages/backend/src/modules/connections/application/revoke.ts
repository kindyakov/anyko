import type { Clock } from '../../../platform/clock';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';
import type { AuditModule } from '../../audit';

import type { LlmSettingsStore } from './ports';
export const revokeConnection =
  (deps: {
    store: LlmSettingsStore;
    audit: Pick<AuditModule, 'commands'>;
    clock: Clock;
  }) =>
  async (scope: WorkspaceScope) => {
    scope.require('connections.manage');
    const revoked = await deps.store.revoke(
      scope.workspaceId,
      deps.clock.now(),
    );
    if (revoked === null) return;
    await deps.audit.commands.record({
      workspaceId: scope.workspaceId,
      actorId: scope.userId,
      action: 'connections.revoked',
      target: { kind: 'workspace', id: scope.workspaceId },
      data: revoked,
    });
  };
