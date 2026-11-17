import type { Tx } from '../../platform/transactions';

import { isActive } from './application/is-active';
import { listRuns } from './application/list-runs';
import { startRun } from './application/start-run';

import type {
  ProcessingModule,
  ProcessingPorts,
  WorkProcessingStore,
} from './index';

export interface ProcessingDeps {
  store: WorkProcessingStore;
  // Хранилище внутри транзакции действия (infrastructure).
  storeFor: (tx: Tx) => WorkProcessingStore;
  newId: () => string;
}

export function createProcessingModule(deps: ProcessingDeps): ProcessingModule {
  const bind = (store: WorkProcessingStore): ProcessingPorts => ({
    internal: {
      ...store,
    },
    commands: { start: startRun({ store, newId: deps.newId }) },
    queries: {
      isActive: isActive({ store }),
      runs: listRuns({ store }),
    },
  });
  return {
    ...bind(deps.store),
    in: (tx) => bind(deps.storeFor(tx)),
  };
}
