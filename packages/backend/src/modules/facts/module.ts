import { hasSubmittedAttachments } from '@anyko/document-values/attachments';

import type { Tx } from '../../platform/transactions';

import { acceptRunCandidates } from './application/accept-run-candidates';
import { confirmValues } from './application/confirm-facts';
import { editValues } from './application/edit-values';
import { readAnalysisFacts } from './application/read-analysis-facts';
import { readFacts } from './application/read-facts';
import { packageFacts, refreshFactEvidence } from './domain/values';

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
      async removeSubmittedAttachment(workspaceId, workId, documentId, fields) {
        if (!hasSubmittedAttachments(fields)) return;
        const facts = await store.get(workspaceId, workId);
        const rows = facts.values.submittedAttachments;
        if (!Array.isArray(rows)) return;
        const kept = rows.filter((row) => row.documentId !== documentId);
        if (kept.length === rows.length) return;
        await store.save(workspaceId, workId, {
          ...facts,
          values: { ...facts.values, submittedAttachments: kept },
        });
      },
      async defaultDocumentDate(workspaceId, workId, date) {
        const facts = await store.get(workspaceId, workId);
        if (facts.values.documentDate == null)
          await store.save(workspaceId, workId, {
            ...facts,
            values: { ...facts.values, documentDate: date },
          });
      },
      async refreshEvidence(workspaceId, workId, refresh, fields) {
        const facts = refreshFactEvidence(
          await store.get(workspaceId, workId),
          refresh,
          fields,
        );
        await store.save(workspaceId, workId, facts);
        return packageFacts(facts, fields);
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
