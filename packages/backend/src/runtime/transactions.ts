import type { Database } from '@anyko/database';

import { openTransaction, type UnitOfWork } from '../platform/transactions';

// Единственная реализация UnitOfWork поверх Prisma: один $transaction на вызов run. Модули
// превращают токен в свои хранилища в infrastructure (storeFor), сюда драйвер не выходит.
export function createUnitOfWork(
  db: Pick<Database, '$transaction'>,
): UnitOfWork {
  return {
    async run(work, signal) {
      signal?.throwIfAborted();
      return db.$transaction(async (tx) => {
        signal?.throwIfAborted();
        const result = await work(openTransaction(tx));
        // Ошибка из callback откатывает транзакцию до того, как Prisma отправит COMMIT.
        signal?.throwIfAborted();
        return result;
      });
    },
  };
}
