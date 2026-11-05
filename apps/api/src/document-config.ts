import { z } from 'zod';
const schema = z.object({
  DATABASE_URL: z.url(),
  AUTH_SECRET: z.string().min(32),
  AUTH_BASE_URL: z.url(),
  APP_ORIGIN: z.url(),
  S3_ENDPOINT: z.url(),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
});
export function parseDocumentConfig(env: unknown) {
  const parsed = schema.safeParse(env);
  if (!parsed.success)
    throw new Error(
      `INVALID_DOCUMENT_ENV: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    );
  return parsed.data;
}
