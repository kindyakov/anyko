import type { Tx } from '../../platform/transactions';

import { isActive } from './application/is-active';
import { listRuns } from './application/list-runs';
import { readLlmConfiguration } from './application/read-llm-configuration';
import { startRun } from './application/start-run';

import type {
  LlmSettingsStore,
  ProcessingModule,
  ProcessingPorts,
  WorkProcessingStore,
} from './index';

export interface ProcessingDeps {
  store: WorkProcessingStore;
  // Хранилище внутри транзакции действия (infrastructure).
  storeFor: (tx: Tx) => WorkProcessingStore;
  settings: LlmSettingsStore;
  newId: () => string;
}

export function createProcessingModule(deps: ProcessingDeps): ProcessingModule {
  const bind = (store: WorkProcessingStore): ProcessingPorts => ({
    internal: {
      ...store,
      connection: (workspaceId, revision) =>
        deps.settings.connection(workspaceId, revision),
    },
    commands: { start: startRun({ store, newId: deps.newId }) },
    queries: {
      isActive: isActive({ store }),
      runs: listRuns({ store }),
      llmConfiguration: readLlmConfiguration({ settings: deps.settings }),
    },
  });
  return {
    ...bind(deps.store),
    in: (tx) => bind(deps.storeFor(tx)),
  };
}
