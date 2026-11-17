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
  'IDEMPOTENCY_IN_PROGRESS',
  'UNAUTHORIZED',
  'INVALID_ORIGIN',
  'INVALID_IDEMPOTENCY_KEY',
  'STREAM_LIMIT',
  'INVALID_REQUEST',
  'INTERNAL_ERROR',
]);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const fieldErrorCodeSchema = z.enum([
  'required',
  'invalid_type',
  'invalid_format',
  'too_short',
  'too_long',
  'too_small',
  'too_big',
  'invalid_value',
]);

export const httpErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    requestId: z.string().max(128),
    fields: z
      .array(
        z.object({
          path: z.array(z.union([z.string(), z.number().int()])),
          code: fieldErrorCodeSchema,
        }),
      )
      .optional(),
  }),
});
