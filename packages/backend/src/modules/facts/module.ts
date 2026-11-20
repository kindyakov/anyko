import type { Tx } from '../../platform/transactions';

import { acceptRunCandidates } from './application/accept-run-candidates';
import { confirmValues } from './application/confirm-facts';
import { editValues } from './application/edit-values';
import { readAnalysisFacts } from './application/read-analysis-facts';
import { readFacts } from './application/read-facts';
import { refreshFactEvidence } from './domain/values';

import type { FactsModule, FactsPorts, FactsStore } from './index';

export interface FactsDeps {
  store: FactsStore;
  // Хранилище внутри транзакции действия (infrastructure).
  storeFor: (tx: Tx) => FactsStore;
}

export function createFactsModule(deps: FactsDeps): FactsModule {
  const bind = (store: FactsStore): FactsPorts => ({
    internal: {
      erase: (workspaceId, workId) => store.erase(workspaceId, workId),
      async defaultDocumentDate(workspaceId, workId, date) {
        const facts = await store.get(workspaceId, workId);
        if (facts.values.documentDate === null)
          await store.save(workspaceId, workId, {
            ...facts,
            values: { ...facts.values, documentDate: date },
          });
      },
      async refreshEvidence(workspaceId, workId, refresh) {
        const facts = refreshFactEvidence(
          await store.get(workspaceId, workId),
          refresh,
        );
        await store.save(workspaceId, workId, facts);
        return facts;
      },
    },
    commands: {
      acceptRunCandidates: acceptRunCandidates({ store }),
      edit: editValues({ store }),
      confirm: confirmValues({ store }),
    },
    queries: {
      get: readFacts({ store }),
      forAnalysis: readAnalysisFacts(store),
    },
  });
  return {
    ...bind(deps.store),
    in: (tx) => bind(deps.storeFor(tx)),
  };
}
