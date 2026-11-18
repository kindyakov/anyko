import type { Clock } from '../../platform/clock';
import type { Tx, UnitOfWork } from '../../platform/transactions';

import { isActive } from './application/is-active';
import { listRuns } from './application/list-runs';
import { startRun } from './application/start-run';
import { claimWorkAttempt } from './application/work-attempt';
import type { WorkProcessingStore } from './application/work-ports';

import type { ProcessingModule, ProcessingPorts } from './index';

export interface ProcessingDeps {
  uow: UnitOfWork;
  store: WorkProcessingStore;
  // Хранилище внутри транзакции действия (infrastructure).
  storeFor: (tx: Tx) => WorkProcessingStore;
  newId: () => string;
  clock: Clock;
}

export function createProcessingModule(deps: ProcessingDeps): ProcessingModule {
  const bind = (store: WorkProcessingStore): ProcessingPorts => ({
    internal: {
      thread: store.thread,
      threads: store.threads,
      cancel: store.cancel,
      erase: store.erase,
      eraseThreads: store.eraseThreads,
    },
    commands: { start: startRun({ store, newId: deps.newId }) },
    queries: {
      isActive: isActive({ store }),
      runs: listRuns({ store }),
    },
  });
  return {
    ...bind(deps.store),
    claimAttempt: claimWorkAttempt(deps),
    in: (tx) => bind(deps.storeFor(tx)),
  };
}
