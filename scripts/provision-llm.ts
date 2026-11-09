import { z } from 'zod';

import { provisionLlm } from '@anyko/backend/runtime';
const schema = z.object({
  DATABASE_URL: z.url(),
  LLM_CONFIG_ENCRYPTION_KEY: z.string().regex(/^[a-f\d]{64}$/i),
  ROUTERAI_API_KEY: z.string().min(1),
  ROUTERAI_BASE_URL: z.url().default('https://routerai.ru/api/v1'),
  LLM_MODEL_ID: z.string().default('~deepseek/deepseek-v4-flash-latest'),
  LLM_WORKSPACE_ID: z.string().default('local'),
});
const env = schema.safeParse(process.env);
if (!env.success) {
  console.error(
    `INVALID_ENV: ${env.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
  );
  process.exitCode = 1;
} else {
  try {
    const status = await provisionLlm({
      databaseUrl: env.data.DATABASE_URL,
      encryptionKey: env.data.LLM_CONFIG_ENCRYPTION_KEY,
      workspaceId: env.data.LLM_WORKSPACE_ID,
      apiKey: env.data.ROUTERAI_API_KEY,
      baseURL: env.data.ROUTERAI_BASE_URL,
      modelId: env.data.LLM_MODEL_ID,
    });
    console.log(`LLM: ${status}`);
  } catch {
    console.error('LLM_PROVISION_FAILED');
    process.exitCode = 1;
  }
}
