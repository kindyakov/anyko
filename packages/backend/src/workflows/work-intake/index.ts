import type { AgentsModule } from '../../modules/agents';
import type { ConnectionsModule } from '../../modules/connections';
import type { DocumentsModule, ResourceLocks } from '../../modules/documents';
import type { ProcessingModule } from '../../modules/processing';
import type { WorksModule } from '../../modules/works';
import type { UnitOfWork } from '../../platform/transactions';

import { analyzeWork } from './analyze-work';
import { createWork } from './create-work';
import { removeDocument } from './remove-document';
import { uploadDocument } from './upload-document';

export interface WorkIntakeDeps {
  uow: UnitOfWork;
  works: WorksModule;
  processing: ProcessingModule;
  connections: ConnectionsModule;
  agents: AgentsModule;
  documents: DocumentsModule;
  locks: ResourceLocks;
}

// Процесс «приём работы»: создание, загрузка и удаление исходников, запуск анализа.
export function createWorkIntake(deps: WorkIntakeDeps) {
  return {
    createWork: createWork(deps),
    uploadDocument: uploadDocument(deps),
    removeDocument: removeDocument(deps),
    analyzeWork: analyzeWork(deps),
  };
}
export type WorkIntake = ReturnType<typeof createWorkIntake>;
