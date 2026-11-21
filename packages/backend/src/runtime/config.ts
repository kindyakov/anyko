import { z } from 'zod';

const postgresUrl = z
  .url()
  .refine((value) => /^postgres(ql)?:\/\//.test(value));
const httpUrl = z.url().refine((value) => /^https?:\/\//.test(value));
const redisUrl = z.url().refine((value) => /^rediss?:\/\//.test(value));
const encryptionKey = z.string().regex(/^[a-f\d]{64}$/i);

/**
 * Sections are already read from the environment by the application; the runtime never
 * reads `process.env` itself. `auth` is required by the API role, `worker` by the worker role.
 */
const backendConfigSchema = z
  .object({
    database: z.object({ url: postgresUrl }).strict(),
    storage: z
      .object({
        endpoint: z.url(),
        bucket: z.string().min(1),
        accessKeyId: z.string().min(1),
        secretAccessKey: z.string().min(1),
      })
      .strict(),
    works: z
      .object({ encryptionKey, chatRedisUrl: redisUrl.optional() })
      .strict(),
    auth: z
      .object({
        secret: z.string().min(32),
        baseUrl: z.url(),
        origin: z.url(),
      })
      .strict()
      .optional(),
    worker: z
      .object({
        redisUrl,
        llmTraceDirectory: z.string().min(1).optional(),
        mineru: z
          .object({
            baseUrl: httpUrl,
            timeoutMs: z.number().int().min(1000).max(600000),
          })
          .strict(),
        shutdownTimeoutMs: z.number().int().min(100).max(600000),
      })
      .strict()
      .optional(),
  })
  .strict();

export type BackendConfig = z.infer<typeof backendConfigSchema>;

export type BackendConfigErrorCode =
  'CONFIG_MODE_MISMATCH' | 'BACKEND_CONFIG_INVALID' | 'BACKEND_CONFIG_MISSING';

/** Carries a stable code for the startup log; detail names fields, never their values. */
export class BackendConfigError extends Error {
  constructor(
    readonly code: BackendConfigErrorCode,
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

/**
 * Two modes only. `full` enables documents and works and needs every section; `empty`
 * starts the health endpoint without database, storage or document/work queues.
 */
export function resolveBackendMode(flags: {
  documentsEnabled: boolean;
  worksEnabled: boolean;
}): 'empty' | 'full' {
  if (flags.documentsEnabled !== flags.worksEnabled)
    throw new BackendConfigError('CONFIG_MODE_MISMATCH');
  return flags.documentsEnabled ? 'full' : 'empty';
}

export function validateBackendConfig(input: unknown): BackendConfig {
  const result = backendConfigSchema.safeParse(input);
  if (!result.success)
    throw new BackendConfigError(
      'BACKEND_CONFIG_INVALID',
      [
        ...new Set(result.error.issues.map((issue) => issue.path.join('.'))),
      ].join(', '),
    );
  return result.data;
}
