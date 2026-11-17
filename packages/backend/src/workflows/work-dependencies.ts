import type { Logger } from '@anyko/logger';

import type { AgentsModule } from '../modules/agents';
import type { ConnectionsModule } from '../modules/connections';
import type {
  DocumentIo,
  DocumentsModule,
  ResourceLocks,
  SourceStorage,
} from '../modules/documents';
import type { FactsModule } from '../modules/facts';
import type { GenerationModule } from '../modules/generation';
import type { ProcessingModule } from '../modules/processing';
import type { WorksModule } from '../modules/works';
import type { UnitOfWork } from '../platform/transactions';

// Зависимости исполнения работы: собирает runtime. Процессы получают фасады модулей и UnitOfWork,
// а не наборы хранилищ; внешние вызовы модели (model) выполняются вне UnitOfWork.
export interface WorkDependencies {
  newId(): string;
  uow: UnitOfWork;
  works: WorksModule;
  facts: FactsModule;
  generation: GenerationModule;
  processing: ProcessingModule;
  connections: ConnectionsModule;
  agents: AgentsModule;
  documents: DocumentsModule;
  locks: ResourceLocks;
  documentIo: DocumentIo;
  workIo: {
    run<T>(
      workspaceId: string,
      workId: string,
      operation: () => Promise<T>,
    ): Promise<T>;
    clean(workspaceId: string, workId: string): Promise<boolean>;
    assertIdle(workspaceId: string, workId: string): Promise<void>;
  };
  assertNoDocumentWriters(
    workspaceId: string,
    documentId: string,
    requestKey: string,
  ): Promise<void>;
  storage: SourceStorage;
  logger: Logger;
}
