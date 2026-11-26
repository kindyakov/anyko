import type { Logger } from '@anyko/logger';

import type { AgentsModule, ChatProgressFeed } from '../modules/agents';
import type { ConnectionsModule } from '../modules/connections';
import type {
  DocumentsModule,
  ResourceLocks,
  SourceStorage,
} from '../modules/documents';
import type { FactsModule } from '../modules/facts';
import type { GenerationModule } from '../modules/generation';
import type { ProcessingIo, ProcessingModule } from '../modules/processing';
import type { ReadTemplateRequirements } from '../modules/templates';
import type { WorksModule } from '../modules/works';
import type { UnitOfWork } from '../platform/transactions';

import type { ResolveWorkPackage } from './work-package';

// Зависимости исполнения работы: собирает runtime. Процессы получают фасады модулей и UnitOfWork,
// а не наборы хранилищ; внешние вызовы модели (model) выполняются вне UnitOfWork.
export interface WorkDependencies {
  resolvePackage: ResolveWorkPackage;
  chatProgress?: ChatProgressFeed;
  newId(): string;
  uow: UnitOfWork;
  works: WorksModule;
  facts: FactsModule;
  generation: GenerationModule;
  templateRequirements: ReadTemplateRequirements;
  processing: ProcessingModule;
  connections: ConnectionsModule;
  agents: AgentsModule;
  documents: DocumentsModule;
  locks: ResourceLocks;
  io: ProcessingIo;
  storage: SourceStorage;
  logger: Logger;
}
