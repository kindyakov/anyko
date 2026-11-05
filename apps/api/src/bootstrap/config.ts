import { z } from 'zod';
const schema = z.object({
  DOCUMENTS_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  RELEASE: z
    .string()
    .regex(/^[\w.-]{1,128}$/)
    .default('local'),
  LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
  API_HOST: z.string().min(1).default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  SHUTDOWN_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(120000)
    .default(10000),
});
export function parseApiConfig(env: unknown) {
  const result = schema.safeParse(env);
  if (!result.success)
    throw new Error(
      `Invalid API configuration: ${result.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    );
  return result.data;
}
