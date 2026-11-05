import { createDatabase } from '@anyko/database';
import {
  createDocumentService,
  type SourceStorage,
} from '../modules/documents';
import { createDocumentUnitOfWork } from './document-unit-of-work';
import type { Logger } from '@anyko/logger';

export function createDocumentRuntime(options: {
  databaseUrl: string;
  storage: SourceStorage;
  logger: Logger;
}) {
  const db = createDatabase(options.databaseUrl);
  const documents = createDocumentService(
    createDocumentUnitOfWork(db),
    options.storage,
    options.logger,
  );
  return {
    ...documents,
    async ready() {
      await db.$queryRaw`SELECT 1`;
    },
    stop: () => db.$disconnect(),
  };
}
export type { SourceStorage };
export { createS3Storage } from '../modules/documents/infrastructure/s3-storage';
