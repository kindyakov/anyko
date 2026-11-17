import type { Logger } from '@anyko/logger';
import { startJobWorker } from '@anyko/worker/queues';

import type {
  DocumentParser,
  SourceStorage,
} from '../../src/modules/documents';
import { type BackendConfig, createBackend } from '../../src/runtime';

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

/** Starts one document consumer in its own worker backend, as a separate process would. */
export async function startDocumentConsumer(
  config: BackendConfig,
  options: {
    logger: Logger;
    storage: SourceStorage;
    parser: DocumentParser;
    queueName: string;
  },
) {
  const backend = createBackend(config, {
    logger: options.logger,
    role: 'worker',
    dependencies: { storage: options.storage, parser: options.parser },
  });
  await backend.ready();
  const worker = await startJobWorker(backend.jobs, {
    queues: 'ocr,maintenance',
    queueNames: { ocr: options.queueName },
    prefix: options.queueName,
    legacy: false,
  });
  return {
    async stop() {
      await worker.stop();
      await backend.stop();
    },
  };
}
