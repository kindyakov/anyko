import { expect, test } from 'bun:test';

import {
  createDatabase,
  createDatabasePool,
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

/** Counts the factories the composition root calls; each process must call them once. */
function countingSeams() {
  const pools: DatabasePool[] = [];
  const clients: Database[] = [];
  return {
    pools,
    clients,
    dependencies: {
      createPool(url: string) {
        const pool = createDatabasePool(url);
        pools.push(pool);
        return pool;
      },
      createDatabase(pool: DatabasePool) {
        const client = createDatabase(pool);
        clients.push(client);
        return client;
      },
    },
  };
}

test('api role creates one pool and one database client for every resource it uses', async () => {
  const seams = countingSeams();
  const backend = createBackend(config, {
    logger,
    role: 'api',
    dependencies: seams.dependencies,
  });
  expect(seams.pools).toHaveLength(1);
  expect(seams.clients).toHaveLength(1);
  expect(backend.documentHttp.origin).toBe('http://127.0.0.1:3020');
  await backend.stop();
});

test('worker role creates one pool and one database client for every resource it uses', async () => {
  const seams = countingSeams();
  const backend = createBackend(config, {
    logger,
    role: 'worker',
    dependencies: seams.dependencies,
  });
  expect(seams.pools).toHaveLength(1);
  expect(seams.clients).toHaveLength(1);
  await backend.stop();
});

test('stop ends the shared pool once and repeated calls share the same outcome', async () => {
  const seams = countingSeams();
  const backend = createBackend(config, {
    logger,
    role: 'api',
    dependencies: seams.dependencies,
  });
  const [pool] = seams.pools;
  if (!pool) throw new Error('pool factory was not called');
  expect(pool.ended).toBe(false);
  const first = backend.stop();
  const second = backend.stop();
  expect(second).toBe(first);
  await first;
  expect(pool.ended).toBe(true);
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
