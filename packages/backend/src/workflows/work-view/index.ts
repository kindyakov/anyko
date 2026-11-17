import type { AgentsModule } from '../../modules/agents';
import type { DocumentsModule, ResourceLocks } from '../../modules/documents';
import type { FactsModule } from '../../modules/facts';
import type { GenerationModule } from '../../modules/generation';
import type { ProcessingModule } from '../../modules/processing';
import { availablePackages } from '../../modules/templates';
import type { WorksModule } from '../../modules/works';

import { getImage } from './get-image';
import { getResult } from './get-result';
import { getSource } from './get-source';
import { getWork } from './get-work';

export interface WorkViewDeps {
  works: WorksModule;
  facts: FactsModule;
  processing: ProcessingModule;
  generation: GenerationModule;
  documents: DocumentsModule;
  agents: AgentsModule;
  locks: ResourceLocks;
}

// Процесс «просмотр работы»: представление, исходники, результаты распознавания и каталог пакетов для создания работы.
export function createWorkView(deps: WorkViewDeps) {
  return {
    packages: availablePackages,
    get: getWork(deps),
    source: getSource(deps),
    image: getImage(deps),
    result: getResult(deps),
  };
}
export type WorkViews = ReturnType<typeof createWorkView>;
