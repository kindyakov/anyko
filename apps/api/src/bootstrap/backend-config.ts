import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.url(),
  S3_ENDPOINT: z.url(),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  LLM_CONFIG_ENCRYPTION_KEY: z.string().regex(/^[a-f\d]{64}$/i),
  AUTH_SECRET: z.string().min(32),
  AUTH_BASE_URL: z.url(),
  APP_ORIGIN: z.url(),
  REDIS_URL: z
    .url()
    .refine((value) => /^rediss?:\/\//.test(value))
    .optional(),
});

/** Maps full-mode environment to the `BackendConfig` sections; values are not echoed. */
export function parseBackendEnv(env: unknown) {
  const parsed = schema.safeParse(env);
  if (!parsed.success)
    throw new Error(
      `INVALID_BACKEND_ENV: ${[...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))].join(', ')}`,
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
      chatRedisUrl: value.REDIS_URL,
    },
    auth: {
      secret: value.AUTH_SECRET,
      baseUrl: value.AUTH_BASE_URL,
      origin: value.APP_ORIGIN,
    },
  };
}
