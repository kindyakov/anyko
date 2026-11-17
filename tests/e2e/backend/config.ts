import { z } from 'zod';

const schema = z.object({
  E2E_DATABASE_URL: z.url(),
  E2E_REDIS_URL: z.url(),
  E2E_OWNER_EMAIL: z.email(),
  E2E_OWNER_PASSWORD: z.string().min(12),
  E2E_MEMBER_EMAIL: z.email(),
  E2E_MEMBER_PASSWORD: z.string().min(12),
  E2E_OUTSIDER_EMAIL: z.email(),
  E2E_OUTSIDER_PASSWORD: z.string().min(12),
  E2E_PROCESSING_DELAY_MS: z.coerce
    .number()
    .int()
    .min(0)
    .max(30000)
    .default(300),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3031),
  APP_ORIGIN: z.url(),
  AUTH_BASE_URL: z.url(),
  AUTH_SECRET: z.string().min(32),
  LLM_CONFIG_ENCRYPTION_KEY: z.string().regex(/^[a-f\d]{64}$/i),
});

export function parseE2eConfig(input: unknown) {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new Error(
      `INVALID_E2E_CONFIG: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
    );
  const config = result.data;
  const database = new URL(config.E2E_DATABASE_URL);
  const databaseName = decodeURIComponent(database.pathname.slice(1));
  if (
    !['postgres:', 'postgresql:'].includes(database.protocol) ||
    !/^[a-zA-Z0-9_]+_e2e$/.test(databaseName) ||
    (database.searchParams.has('schema') &&
      database.searchParams.get('schema') !== 'public')
  )
    throw new Error('E2E_DATABASE_MUST_END_IN_E2E_AND_USE_PUBLIC_SCHEMA');
  if (!['redis:', 'rediss:'].includes(new URL(config.E2E_REDIS_URL).protocol))
    throw new Error('INVALID_E2E_REDIS_URL');
  if (
    new Set([
      config.E2E_OWNER_EMAIL.toLowerCase(),
      config.E2E_MEMBER_EMAIL.toLowerCase(),
      config.E2E_OUTSIDER_EMAIL.toLowerCase(),
    ]).size !== 3
  )
    throw new Error('E2E_USERS_MUST_BE_DISTINCT');
  return config;
}

export const E2E_QUEUE_PREFIX = 'anyko-e2e';
