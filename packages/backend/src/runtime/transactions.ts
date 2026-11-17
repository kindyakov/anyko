import type { Database } from '@anyko/database';

import { openTransaction, type UnitOfWork } from '../platform/transactions';

// Единственная реализация UnitOfWork поверх Prisma: один $transaction на вызов run. Модули
// превращают токен в свои хранилища в infrastructure (storeFor), сюда драйвер не выходит.
export function createUnitOfWork(
  db: Pick<Database, '$transaction'>,
): UnitOfWork {
  return {
    run: (work) => db.$transaction((tx) => work(openTransaction(tx))),
  };
}
