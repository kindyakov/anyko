import { inOperation } from '@anyko/logger';

import type { AgentsModule } from '../../modules/agents';
import type { ConnectionsModule } from '../../modules/connections';
import type { DocumentsModule, ResourceLocks } from '../../modules/documents';
import type { FactsModule } from '../../modules/facts';
import type { GenerationModule } from '../../modules/generation';
import type { ProcessingModule } from '../../modules/processing';
import {
  availablePackages,
  type ReadTemplatePlaceholders,
  type ReadTemplateRequirements,
} from '../../modules/templates';
import type { WorksModule } from '../../modules/works';
import type { ResolveWorkPackage } from '../work-package';

import { agentHistoryQueries } from './get-agent-history';
import { getImage } from './get-image';
import { getResult } from './get-result';
import { getSource } from './get-source';
import { getWork } from './get-work';

export interface WorkViewDeps {
  resolvePackage: ResolveWorkPackage;
  works: WorksModule;
  facts: FactsModule;
  processing: ProcessingModule;
  connections: ConnectionsModule;
  generation: GenerationModule;
  templatePlaceholders: ReadTemplatePlaceholders;
  templateRequirements: ReadTemplateRequirements;
  documents: DocumentsModule;
  agents: AgentsModule;
  locks: ResourceLocks;
}

// Процесс «просмотр работы»: представление, исходники, результаты распознавания и каталог пакетов для создания работы.
export function createWorkView(deps: WorkViewDeps) {
  return {
    packages: () =>
      inOperation('catalog.listDocumentPackages', () =>
        Promise.all(availablePackages().map(deps.templatePlaceholders)),
      ),
    get: getWork(deps),
    ...agentHistoryQueries(deps),
    source: getSource(deps),
    image: getImage(deps),
    result: getResult(deps),
  };
}
export type WorkViews = ReturnType<typeof createWorkView>;
