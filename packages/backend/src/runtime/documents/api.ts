import { createDatabase, createResourceLocks } from '@anyko/database';
import type { Logger } from '@anyko/logger';

import {
  createDocumentService,
  type SourceStorage,
} from '../../modules/documents';
import { createArtifactRegistry } from '../../modules/documents/infrastructure/artifact-store';
import { createDocumentIo } from '../../modules/documents/infrastructure/document-io';

import { createDocumentUnitOfWork } from './unit-of-work';

export function createDocumentRuntime(options: {
  databaseUrl: string;
  storage: SourceStorage;
  logger: Logger;
}) {
  const db = createDatabase(options.databaseUrl);
  const locks = createResourceLocks(options.databaseUrl);
  const documents = createDocumentService(
    createDocumentUnitOfWork(db),
    options.storage,
    options.logger,
    createArtifactRegistry(db),
    locks,
    createDocumentIo(db),
  );
  return {
    ...documents,
    async ready() {
      await options.storage.ready?.();
      await db.$queryRaw`SELECT 1`;
    },
    stop: async () => {
      await locks.stop();
      await db.$disconnect();
    },
  };
}
export type { SourceStorage };
export { createS3Storage } from '../../modules/documents/infrastructure/s3-storage';
