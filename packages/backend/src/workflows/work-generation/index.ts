import type { AuditModule } from '../../modules/audit';
import type { ConnectionsModule } from '../../modules/connections';
import type { ResourceLocks, SourceStorage } from '../../modules/documents';
import type { FactsModule } from '../../modules/facts';
import type { GenerationModule } from '../../modules/generation';
import type { ProcessingModule } from '../../modules/processing';
import type { WorksModule } from '../../modules/works';
import type { UnitOfWork } from '../../platform/transactions';

import { downloadResult } from './download-result';
import { startGeneration } from './start-generation';

export interface WorkGenerationDeps {
  uow: UnitOfWork;
  works: WorksModule;
  facts: FactsModule;
  processing: ProcessingModule;
  connections: ConnectionsModule;
  generation: GenerationModule;
  audit: AuditModule;
  storage: SourceStorage;
  locks: ResourceLocks;
}

// Процесс «генерация документов»: старт запуска и скачивание результата. Исполнение запуска
// находится в workflows/work-generation/run-generation.
export function createWorkGeneration(deps: WorkGenerationDeps) {
  return {
    startGeneration: startGeneration(deps),
    downloadResult: downloadResult(deps),
  };
}
export type WorkGeneration = ReturnType<typeof createWorkGeneration>;
