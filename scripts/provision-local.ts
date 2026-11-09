import { z } from 'zod';

import { provisionLocalAccess } from '@anyko/backend/access';

const schema = z.object({
  DATABASE_URL: z.url(),
  AUTH_SECRET: z.string().min(32),
  AUTH_BASE_URL: z.url(),
  APP_ORIGIN: z.url(),
  LOCAL_USER_EMAIL: z.email(),
  LOCAL_USER_PASSWORD: z.string().min(12),
});
const config = schema.safeParse(process.env);
if (!config.success) {
  console.error('Local provisioning configuration is incomplete');
  process.exitCode = 1;
} else {
  try {
    const c = config.data;
    await provisionLocalAccess({
      databaseUrl: c.DATABASE_URL,
      secret: c.AUTH_SECRET,
      baseURL: c.AUTH_BASE_URL,
      origin: c.APP_ORIGIN,
      email: c.LOCAL_USER_EMAIL,
      password: c.LOCAL_USER_PASSWORD,
    });
    console.info(
      'Local user and workspace are ready. Credentials remain in the ignored root .env.',
    );
  } catch {
    console.error('LOCAL_PROVISIONING_FAILED');
    process.exitCode = 1;
  }
}
