import type { Tx } from '../../platform/transactions';

import { createGeneration } from './application/create-generation';
import { listGenerations } from './application/list-generations';
import { readGeneration } from './application/read-generation';

import type {
  GenerationModule,
  GenerationPorts,
  GenerationStore,
} from './index';

export interface GenerationDeps {
  store: GenerationStore;
  // Хранилище внутри транзакции действия (infrastructure).
  storeFor: (tx: Tx) => GenerationStore;
  newId: () => string;
}

export function createGenerationModule(deps: GenerationDeps): GenerationModule {
  const bind = (store: GenerationStore): GenerationPorts => ({
    commands: { create: createGeneration({ store, newId: deps.newId }) },
    queries: {
      get: readGeneration({ store }),
      list: listGenerations({ store }),
    },
  });
  return {
    ...bind(deps.store),
    in: (tx) => bind(deps.storeFor(tx)),
  };
}
