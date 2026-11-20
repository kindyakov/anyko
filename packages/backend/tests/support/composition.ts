import type { BackendConfig } from '../../src/runtime';

/** Full-mode configuration for integration suites; external endpoints are unreachable placeholders. */
export function integrationConfig(input: {
  databaseUrl: string;
  redisUrl: string;
  encryptionKey?: string;
}): BackendConfig {
  return {
    database: { url: input.databaseUrl },
    storage: {
      endpoint: 'http://127.0.0.1:1',
      bucket: 'fixture',
      accessKeyId: 'fixture',
      secretAccessKey: 'fixture',
    },
    works: { encryptionKey: input.encryptionKey ?? 'b'.repeat(64) },
    auth: {
      secret: 'f'.repeat(32),
      baseUrl: 'http://127.0.0.1:3020',
      origin: 'http://127.0.0.1:3020',
    },
    worker: {
      redisUrl: input.redisUrl,
      mineru: { baseUrl: 'http://127.0.0.1:1', timeoutMs: 240000 },
      shutdownTimeoutMs: 10000,
    },
  };
}
