import { expect, test } from 'bun:test';

import {
  createDatabase,
  createDatabasePool,
  createLockPool,
  type Database,
  type DatabasePool,
} from '@anyko/database';
import { createLogger } from '@anyko/logger';

import {
  type BackendConfig,
  BackendConfigError,
  createBackend,
  resolveBackendMode,
} from '../../src/runtime';
import { integrationConfig } from '../support/composition';

// No server is contacted: Prisma and pg connect lazily, and the S3 client only sends on use.
const logger = createLogger({
  service: 'worker',
  environment: 'test',
  release: 'composition',
  level: 'fatal',
});
const config: BackendConfig = integrationConfig({
  databaseUrl: 'postgresql://fixture:fixture@127.0.0.1:1/anyko_test',
  redisUrl: 'redis://127.0.0.1:1',
  encryptionKey: 'a'.repeat(64),
});

/**
 * Counts the factories the composition root calls. Each process must create exactly one
 * query pool and exactly one lock pool, and the database client must sit on the query pool.
 */
function countingSeams() {
  const queryPools: DatabasePool[] = [];
  const lockPools: DatabasePool[] = [];
  const clients: { client: Database; pool: DatabasePool }[] = [];
  return {
    queryPools,
    lockPools,
    clients,
    dependencies: {
      createPool(url: string) {
        const pool = createDatabasePool(url);
        queryPools.push(pool);
        return pool;
      },
      createLockPool(url: string) {
        const pool = createLockPool(url);
        lockPools.push(pool);
        return pool;
      },
      createDatabase(pool: DatabasePool) {
        const client = createDatabase(pool);
        clients.push({ client, pool });
        return client;
      },
    },
  };
}

for (const role of ['api', 'worker'] as const) {
  test(`${role} role creates one query pool, one lock pool and one database client on the query pool`, async () => {
    const seams = countingSeams();
    const options = { logger, dependencies: seams.dependencies };
    const backend =
      role === 'api'
        ? createBackend(config, { ...options, role: 'api' })
        : createBackend(config, { ...options, role: 'worker' });
    expect(seams.queryPools).toHaveLength(1);
    expect(seams.lockPools).toHaveLength(1);
    expect(seams.clients).toHaveLength(1);
    const [queryPool] = seams.queryPools;
    const [lockPool] = seams.lockPools;
    const [client] = seams.clients;
    expect(client?.pool).toBe(queryPool);
    expect(lockPool).not.toBe(queryPool);
    await backend.stop();
  });
}

test('stop ends both pools once and repeated calls share the same outcome', async () => {
  const seams = countingSeams();
  const backend = createBackend(config, {
    logger,
    role: 'api',
    dependencies: seams.dependencies,
  });
  const [queryPool] = seams.queryPools;
  const [lockPool] = seams.lockPools;
  if (!queryPool || !lockPool) throw new Error('pool factory was not called');
  expect(queryPool.ended).toBe(false);
  expect(lockPool.ended).toBe(false);
  const first = backend.stop();
  const second = backend.stop();
  expect(second).toBe(first);
  await first;
  expect(queryPool.ended).toBe(true);
  expect(lockPool.ended).toBe(true);
  await backend.stop();
});

test('each role rejects a config that omits the section it needs', () => {
  const shared = {
    database: config.database,
    storage: config.storage,
    works: config.works,
  };
  const withoutAuth: BackendConfig = { ...shared, worker: config.worker };
  const withoutWorker: BackendConfig = { ...shared, auth: config.auth };
  expect(() =>
    createBackend(withoutAuth, {
      logger,
      role: 'api',
      dependencies: countingSeams().dependencies,
    }),
  ).toThrow(BackendConfigError);
  expect(() =>
    createBackend(withoutWorker, {
      logger,
      role: 'worker',
      dependencies: countingSeams().dependencies,
    }),
  ).toThrow(BackendConfigError);
});

test('invalid configuration names fields without echoing their values', () => {
  const secret = 'not-a-url-sensitive-value';
  try {
    createBackend(
      { ...config, storage: { ...config.storage, endpoint: secret } },
      { logger, role: 'api', dependencies: countingSeams().dependencies },
    );
    throw new Error('Expected rejection');
  } catch (error) {
    if (!(error instanceof BackendConfigError)) throw error;
    expect(error.code).toBe('BACKEND_CONFIG_INVALID');
    expect(error.message).toContain('storage.endpoint');
    expect(error.message).not.toContain(secret);
  }
});

test('two modes only: both flags true is full, both false is empty, any mix is rejected', () => {
  expect(
    resolveBackendMode({ documentsEnabled: true, worksEnabled: true }),
  ).toBe('full');
  expect(
    resolveBackendMode({ documentsEnabled: false, worksEnabled: false }),
  ).toBe('empty');
  for (const flags of [
    { documentsEnabled: true, worksEnabled: false },
    { documentsEnabled: false, worksEnabled: true },
  ]) {
    try {
      resolveBackendMode(flags);
      throw new Error('Expected rejection');
    } catch (error) {
      if (!(error instanceof BackendConfigError)) throw error;
      expect(error.code).toBe('CONFIG_MODE_MISMATCH');
    }
  }
});
