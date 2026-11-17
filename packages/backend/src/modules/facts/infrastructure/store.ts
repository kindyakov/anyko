import type { Database } from '@anyko/database';

import { emptyFacts, type FactsStore } from '..';
import { transactionHandle, type Tx } from '../../../platform/transactions';
import { factsSchema } from '../schemas';

export function createFactsStore(db: Pick<Database, 'workFacts'>): FactsStore {
  return {
    async get(workspaceId, workId) {
      const row = await db.workFacts.findFirst({
        where: { workspaceId, workId },
      });
      return row ? factsSchema.parse(row.payload) : emptyFacts();
    },
    async save(workspaceId, workId, facts) {
      const payload = factsSchema.parse(facts);
      await db.workFacts.upsert({
        where: { workId },
        create: { workspaceId, workId, payload },
        update: { payload },
      });
    },
    async erase(workspaceId, workId) {
      await db.workFacts.deleteMany({ where: { workspaceId, workId } });
    },
  };
}

// Сведения внутри транзакции действия: токен превращается в клиент транзакции драйвера.
export function factsStoreFor(tx: Tx): FactsStore {
  return createFactsStore(transactionHandle<Pick<Database, 'workFacts'>>(tx));
}
