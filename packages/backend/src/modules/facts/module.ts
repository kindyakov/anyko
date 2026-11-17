import type { Tx } from '../../platform/transactions';

import { confirmValues } from './application/confirm-facts';
import { editValues } from './application/edit-values';
import { readFacts } from './application/read-facts';

import type { FactsModule, FactsPorts, FactsStore } from './index';

export interface FactsDeps {
  store: FactsStore;
  // Хранилище внутри транзакции действия (infrastructure).
  storeFor: (tx: Tx) => FactsStore;
}

export function createFactsModule(deps: FactsDeps): FactsModule {
  const bind = (store: FactsStore): FactsPorts => ({
    internal: store,
    commands: {
      edit: editValues({ store }),
      confirm: confirmValues({ store }),
    },
    queries: { get: readFacts({ store }) },
  });
  return {
    ...bind(deps.store),
    in: (tx) => bind(deps.storeFor(tx)),
  };
}
