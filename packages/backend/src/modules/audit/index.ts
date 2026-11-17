// Публичный фасад журнала действий. Вызывайте record внутри той же транзакции, что и действие.
import type { AuditRecord } from './domain/events';

export { record } from './infrastructure/record';
export type { AuditWriter } from './infrastructure/record';

// Порт записи события для сценария: привязан к транзакции, в которой выполняется действие.
export interface AuditSink {
  record(event: AuditRecord): Promise<void>;
}
