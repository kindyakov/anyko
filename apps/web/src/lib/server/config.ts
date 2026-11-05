import 'server-only';
import { z } from 'zod';

const schema = z.object({
  API_ORIGIN: z
    .url()
    .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol))
    .default('http://127.0.0.1:3001'),
  RELEASE: z
    .string()
    .regex(/^[\w.-]{1,128}$/)
    .default('local'),
  LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
});
export function readServerConfig() {
  const result = schema.safeParse(process.env);
  if (!result.success)
    throw new Error(
      `Invalid web configuration: ${result.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    );
  return result.data;
}
