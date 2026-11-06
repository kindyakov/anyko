import { z } from 'zod';
const flag = z.object({
  WORKS_ENABLED: z.enum(['true', 'false']).default('false'),
});
const schema = z.object({
  DOCUMENTS_ENABLED: z.literal('true'),
  LLM_CONFIG_ENCRYPTION_KEY: z.string().regex(/^[a-f\d]{64}$/i),
});
export function parseWorkConfig(env: unknown) {
  const enabled = flag.safeParse(env);
  if (!enabled.success) throw new Error('INVALID_ENV: WORKS_ENABLED');
  if (enabled.data.WORKS_ENABLED === 'false') return null;
  const result = schema.safeParse(env);
  if (!result.success)
    throw new Error(
      `INVALID_ENV: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
    );
  return { encryptionKey: result.data.LLM_CONFIG_ENCRYPTION_KEY };
}
