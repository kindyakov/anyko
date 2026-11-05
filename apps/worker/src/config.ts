import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  RELEASE: z
    .string()
    .regex(/^[\w.-]{1,100}$/)
    .default('local'),
  LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
  WORKER_HOST: z.string().min(1).default('127.0.0.1'),
  WORKER_PORT: z.coerce.number().int().min(1).max(65535).default(3002),
  REDIS_URL: z.url().refine((value) => /^rediss?:\/\//.test(value)),
  QUEUE_NAME: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,80}$/)
    .default('anyko-diagnostic'),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(2),
  STARTUP_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(60000)
    .default(10000),
  SHUTDOWN_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(60000)
    .default(10000),
});

export function parseWorkerConfig(env: Record<string, string | undefined>) {
  const result = schema.safeParse(env);
  if (!result.success)
    throw new Error(
      `INVALID_ENV: ${[...new Set(result.error.issues.map((issue) => issue.path.join('.')))].join(', ')}`,
    );
  return result.data;
}
