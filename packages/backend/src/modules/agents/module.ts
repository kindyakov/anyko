import type { Tx } from '../../platform/transactions';

import type { AgentSessionStore } from './application/session';

import type { AgentsModule, AgentsPorts, DocumentAgents } from './index';

export interface AgentsDeps {
  store: AgentSessionStore;
  model: DocumentAgents;
  // Хранилище сессии внутри транзакции действия (infrastructure).
  storeFor: (tx: Tx) => AgentSessionStore;
}

export function createAgentsModule(deps: AgentsDeps): AgentsModule {
  const bind = (store: AgentSessionStore): AgentsPorts => ({ internal: store });
  return {
    ...bind(deps.store),
    model: deps.model,
    in: (tx) => bind(deps.storeFor(tx)),
  };
}
