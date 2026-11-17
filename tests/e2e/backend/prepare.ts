import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';
import { Redis } from 'ioredis';

import { provisionLlm } from '@anyko/backend/runtime';
import { createDatabase, createDatabasePool } from '@anyko/database';

import { grantMembership } from '../../../packages/backend/src/modules/access/infrastructure/auth';

import { E2E_DOCUMENT_QUEUE, E2E_WORK_QUEUE, parseE2eConfig } from './config';

const config = parseE2eConfig(process.env);
const pool = createDatabasePool(config.E2E_DATABASE_URL);
const db = createDatabase(pool);
const redis = new Redis(config.E2E_REDIS_URL, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  lazyConnect: true,
});
try {
  await redis.connect();
  await redis.ping();
  // This is intentionally destructive and may only target the validated *_e2e database.
  await db.$executeRawUnsafe('DROP SCHEMA public CASCADE');
  await db.$executeRawUnsafe('CREATE SCHEMA public');
  const migrate = Bun.spawn(['bun', 'run', 'db:migrate'], {
    env: { ...process.env, DATABASE_URL: config.E2E_DATABASE_URL },
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if ((await migrate.exited) !== 0) throw new Error('E2E_MIGRATION_FAILED');

  for (const queue of [E2E_DOCUMENT_QUEUE, E2E_WORK_QUEUE]) {
    let cursor = '0';
    const collected: string[] = [];
    do {
      const [next, keys] = await redis.scan(
        cursor,
        'MATCH',
        `bull:${queue}:*`,
        'COUNT',
        200,
      );
      cursor = next;
      collected.push(...keys);
    } while (cursor !== '0');
    for (let i = 0; i < collected.length; i += 200)
      await redis.unlink(...collected.slice(i, i + 200));
  }
  const auth = betterAuth({
    database: prismaAdapter(db, { provider: 'postgresql', transaction: true }),
    secret: config.AUTH_SECRET,
    baseURL: config.AUTH_BASE_URL,
    basePath: '/api/auth',
    trustedOrigins: [config.APP_ORIGIN],
    emailAndPassword: { enabled: true, autoSignIn: false },
    logger: { disabled: true },
  });
  const owner = await auth.api.signUpEmail({
    body: {
      email: config.E2E_OWNER_EMAIL,
      password: config.E2E_OWNER_PASSWORD,
      name: 'E2E владелец',
    },
  });
  const member = await auth.api.signUpEmail({
    body: {
      email: config.E2E_MEMBER_EMAIL,
      password: config.E2E_MEMBER_PASSWORD,
      name: 'E2E участник',
    },
  });
  await auth.api.signUpEmail({
    body: {
      email: config.E2E_OUTSIDER_EMAIL,
      password: config.E2E_OUTSIDER_PASSWORD,
      name: 'E2E без области',
    },
  });
  for (const workspace of [
    { id: 'e2e-north', name: 'E2E Север' },
    { id: 'e2e-south', name: 'E2E Юг' },
  ]) {
    await db.anykoWorkspace.create({ data: workspace });
    await grantMembership(db, {
      workspaceId: workspace.id,
      userId: owner.user.id,
      role: 'owner',
    });
    await provisionLlm({
      databaseUrl: config.E2E_DATABASE_URL,
      encryptionKey: config.LLM_CONFIG_ENCRYPTION_KEY,
      workspaceId: workspace.id,
      apiKey: 'e2e-fixture',
      baseURL: 'http://127.0.0.1:1',
      modelId: 'e2e-fixture',
    });
  }
  await grantMembership(db, {
    workspaceId: 'e2e-north',
    userId: member.user.id,
    role: 'member',
  });
  console.info('E2E database and isolated queues prepared');
} finally {
  redis.disconnect();
  await db.$disconnect();
  await pool.end();
}
