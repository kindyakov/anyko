import type { AuditModule } from '../../modules/audit';
import type { ConnectionsModule } from '../../modules/connections';
import type { ResourceLocks, SourceStorage } from '../../modules/documents';
import type { FactsModule } from '../../modules/facts';
import type { GenerationModule } from '../../modules/generation';
import type { ProcessingModule } from '../../modules/processing';
import type { WorksModule } from '../../modules/works';
import type { Clock } from '../../platform/clock';
import type { UnitOfWork } from '../../platform/transactions';
import type { ResolveWorkPackage } from '../work-package';

import { downloadResult } from './download-result';
import { startGeneration } from './start-generation';

export interface WorkGenerationDeps {
  resolvePackage: ResolveWorkPackage;
  uow: UnitOfWork;
  clock: Clock;
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
