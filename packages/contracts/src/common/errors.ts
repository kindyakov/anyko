import { z } from 'zod';

// Каталог кодов, которые API может вернуть клиенту. Тест apps/api сверяет его
// с картами defineErrors модулей и транспортными кодами; новый код добавляется сюда.
export const errorCodeSchema = z.enum([
  'NOT_FOUND',
  'FORBIDDEN',
  'INVALID_WORK_INPUT',
  'REVISION_CONFLICT',
  'WORK_BUSY',
  'LLM_NOT_CONFIGURED',
  'NOT_READY',
  'CLEANUP_PENDING',
  'INVALID_DOCUMENT',
  'UNSUPPORTED_DOCUMENT_FORMAT',
  'RETRY_CONFLICT',
  'IDEMPOTENCY_CONFLICT',
  'UNAUTHORIZED',
  'INVALID_ORIGIN',
  'INVALID_IDEMPOTENCY_KEY',
  'STREAM_LIMIT',
  'INVALID_REQUEST',
  'INTERNAL_ERROR',
]);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const httpErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    requestId: z.string().max(128),
    fields: z
      .array(z.object({ path: z.string(), code: z.string() }))
      .optional(),
  }),
});
