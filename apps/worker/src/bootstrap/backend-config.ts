import { z } from 'zod';

import { defaultMinModelContextTokens } from '@anyko/llm';

export const analysisStepwiseSchema = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

export const minModelContextSchema = z.coerce
  .number()
  .int()
  .positive()
  .default(defaultMinModelContextTokens);

const schema = z.object({
  DATABASE_URL: z.url().refine((value) => /^postgres(ql)?:\/\//.test(value)),
  S3_ENDPOINT: z.url(),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  LLM_CONFIG_ENCRYPTION_KEY: z.string().regex(/^[a-f\d]{64}$/i),
  ANYKO_ANALYSIS_STEPWISE: analysisStepwiseSchema,
  ANYKO_MIN_MODEL_CONTEXT_TOKENS: minModelContextSchema,
  ANYKO_CHAT_MAX_MODEL_CALLS: z.coerce.number().int().min(1).max(64).optional(),
  ANYKO_RECONCILE_MAX_MODEL_CALLS: z.coerce
    .number()
    .int()
    .min(1)
    .max(64)
    .optional(),
  ANYKO_RECONCILE_MAX_READS: z.coerce.number().int().min(1).max(256).optional(),
  ANYKO_VISION_MAX_OUTPUT_TOKENS: z.coerce
    .number()
    .int()
    .min(1)
    .max(16384)
    .optional(),
  ANYKO_ANALYSIS_MAX_READS: z.coerce.number().int().min(1).max(256).optional(),
  ANYKO_ANALYSIS_REVIEW_MAX_READS: z.coerce
    .number()
    .int()
    .min(1)
    .max(256)
    .optional(),
  ANYKO_ANALYSIS_MAX_MODEL_CALLS: z.coerce
    .number()
    .int()
    .min(1)
    .max(64)
    .optional(),
  MINERU_BASE_URL: z.url().refine((value) => /^https?:\/\//.test(value)),
  MINERU_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(600000)
    .default(240000),
});

/**
 * Maps full-mode environment to the `BackendConfig` sections. Values stay in the
 * environment object; errors name fields only.
 */
export function parseBackendEnv(
  env: Record<string, string | undefined>,
  worker: {
    redisUrl: string;
    shutdownTimeoutMs: number;
    llmTraceDirectory?: string | undefined;
  },
) {
  const parsed = schema.safeParse(env);
  if (!parsed.success)
    throw new Error(
      `INVALID_ENV: ${[...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))].join(', ')}`,
    );
  const value = parsed.data;
  return {
    database: { url: value.DATABASE_URL },
    storage: {
      endpoint: value.S3_ENDPOINT,
      bucket: value.S3_BUCKET,
      accessKeyId: value.S3_ACCESS_KEY,
      secretAccessKey: value.S3_SECRET_KEY,
    },
    works: {
      encryptionKey: value.LLM_CONFIG_ENCRYPTION_KEY,
      chatRedisUrl: worker.redisUrl,
    },
    worker: {
      redisUrl: worker.redisUrl,
      mineru: {
        baseUrl: value.MINERU_BASE_URL,
        timeoutMs: value.MINERU_TIMEOUT_MS,
      },
      shutdownTimeoutMs: worker.shutdownTimeoutMs,
      llmTraceDirectory: worker.llmTraceDirectory,
      minModelContextTokens: value.ANYKO_MIN_MODEL_CONTEXT_TOKENS,
      stepwiseAnalysis: value.ANYKO_ANALYSIS_STEPWISE,
      analysisMaxModelCalls: value.ANYKO_ANALYSIS_MAX_MODEL_CALLS,
      analysisMaxReads: value.ANYKO_ANALYSIS_MAX_READS,
      analysisReviewMaxReads: value.ANYKO_ANALYSIS_REVIEW_MAX_READS,
      chatMaxModelCalls: value.ANYKO_CHAT_MAX_MODEL_CALLS,
      reconcileMaxModelCalls: value.ANYKO_RECONCILE_MAX_MODEL_CALLS,
      reconcileMaxReads: value.ANYKO_RECONCILE_MAX_READS,
      visionMaxOutputTokens: value.ANYKO_VISION_MAX_OUTPUT_TOKENS,
    },
  };
}
