import type { Logger } from '@anyko/logger';
import { startJobWorker } from '@anyko/worker/queues';

import type { DocumentAgents } from '../../../../packages/backend/src/modules/agents';
import type {
  DocumentParser,
  SourceStorage,
} from '../../../../packages/backend/src/modules/documents';
import {
  type BackendConfig,
  createBackend,
} from '../../../../packages/backend/src/runtime';
export { integrationConfig } from '../../../../packages/backend/tests/support/composition';

/** Starts one document consumer in its own worker backend, as a separate process would. */
export async function startDocumentConsumer(
  config: BackendConfig,
  options: {
    logger: Logger;
    storage: SourceStorage;
    parser: DocumentParser;
    agents?: DocumentAgents;
    queueName: string;
  },
) {
  const backend = createBackend(config, {
    logger: options.logger,
    role: 'worker',
    dependencies: {
      storage: options.storage,
      parser: options.parser,
      ...(options.agents && { agents: options.agents }),
    },
  });
  await backend.ready();
  const worker = await startJobWorker(backend.jobs, {
    queues: 'ocr,maintenance',
    queueNames: { ocr: options.queueName },
    prefix: options.queueName,
  });
  return {
    async stop() {
      await worker.stop();
      await backend.stop();
    },
  };
}
