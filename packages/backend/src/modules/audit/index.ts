// Публичный фасад журнала действий. Вызывайте record внутри той же транзакции, что и действие.
import type { Tx } from '../../platform/transactions';

import type { AuditRecord } from './domain/events';

export { record } from './infrastructure/record';
export type { AuditWriter } from './infrastructure/record';

// Фасад модуля: команда записи без транзакции и `in(tx)` — та же команда внутри действия.
export interface AuditCommands {
  record(event: AuditRecord): Promise<void>;
}
export interface AuditModule {
  readonly commands: AuditCommands;
  in(tx: Tx): { readonly commands: AuditCommands };
}
