import type { Clock } from '../../platform/clock';
import type { Tx, UnitOfWork } from '../../platform/transactions';
import type { AuditModule } from '../audit';

import { currentConnection } from './application/current';
import { revokeConnection } from './application/revoke';
import { persistConnection, saveConnection } from './application/save';

import type { ConnectionsModule, ConnectionsPorts, LlmSettingsStore } from '.';

export function createConnectionsModule(deps: {
  store: LlmSettingsStore;
  storeFor(tx: Tx): LlmSettingsStore;
  uow: UnitOfWork;
  audit: AuditModule;
  clock: Clock;
}): ConnectionsModule {
  const bind = (
    store: LlmSettingsStore,
    audit: Pick<AuditModule, 'commands'>,
  ): ConnectionsPorts => ({
    commands: {
      save: saveConnection({ store, audit }),
      revoke: revokeConnection({ store, audit, clock: deps.clock }),
    },
    queries: { current: currentConnection({ store }) },
    internal: {
      configuration: (workspaceId, rejectRevoked) =>
        store.current(workspaceId, rejectRevoked),
      connection: (workspaceId, revision) =>
        store.connection(workspaceId, revision),
    },
  });
  const inTx = (tx: Tx) => bind(deps.storeFor(tx), deps.audit.in(tx));
  return {
    ...bind(deps.store, deps.audit),
    commands: {
      save: async (scope, input) => {
        scope.require('connections.manage');
        return deps.uow.run((tx) => inTx(tx).commands.save(scope, input));
      },
      revoke: async (scope) => {
        scope.require('connections.manage');
        return deps.uow.run((tx) => inTx(tx).commands.revoke(scope));
      },
    },
    in: inTx,
    provision: (workspaceId, input) =>
      deps.uow.run(async (tx) => {
        const store = deps.storeFor(tx);
        await store.lock(workspaceId);
        if (await store.current(workspaceId)) return 'already-configured';
        await persistConnection(
          { store, audit: deps.audit.in(tx) },
          workspaceId,
          input,
          null,
        );
        return 'configured';
      }),
  };
}
