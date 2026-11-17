// Публичный фасад повтора команд (ADR 0009). Маршрут передаёт область, команду, ключ и отпечаток;
// сценарий выполняется один раз на ключ. Коды повтора объявляет этот модуль.
export { fingerprintInput } from './application/fingerprint';
export type { IdempotentCommand, IdempotentResult } from './application/run';
export { IdempotencyErrors, IdempotencyFailure } from './errors';
export { createIdempotency, type IdempotencyApi } from './module';
