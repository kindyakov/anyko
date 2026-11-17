import { transactionHandle, type Tx } from '../../platform/transactions';

import type { AuditConnection, AuditWriter } from './infrastructure/record';

import type { AuditCommands, AuditModule } from './index';

export interface AuditDeps {
  // Клиент без транзакции для команды вне действия; внутри действия используется in(tx).
  connection: AuditConnection;
  // Запись события: по умолчанию infrastructure/record; тесты подменяют её, чтобы проверить откат.
  write: AuditWriter;
}

export function createAuditModule(deps: AuditDeps): AuditModule {
  const bind = (connection: AuditConnection): AuditCommands => ({
    record: (event) => deps.write(connection, event),
  });
  return {
    commands: bind(deps.connection),
    in: (tx: Tx) => ({
      commands: bind(transactionHandle<AuditConnection>(tx)),
    }),
  };
}
