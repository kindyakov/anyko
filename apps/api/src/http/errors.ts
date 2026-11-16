// Коды ответов, которые формирует транспорт, а не сценарий. Маршруты берут их
// отсюда; тест каталога сверяет этот объект с errorCodeSchema из contracts.
export const transportErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_ORIGIN: 'INVALID_ORIGIN',
  INVALID_IDEMPOTENCY_KEY: 'INVALID_IDEMPOTENCY_KEY',
  STREAM_LIMIT: 'STREAM_LIMIT',
  INVALID_REQUEST: 'INVALID_REQUEST',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
} as const;
