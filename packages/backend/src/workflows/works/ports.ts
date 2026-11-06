import type { Logger } from '@anyko/logger';

import type { AgentSessionStore, DocumentAgents } from '../../modules/agents';
import type {
  DocumentIo,
  DocumentService,
  ResourceLocks,
  SourceStorage,
} from '../../modules/documents';
import type { FactsStore } from '../../modules/facts';
import type { GenerationStore } from '../../modules/generation';
import type {
  LlmSettingsStore,
  WorkProcessingStore,
} from '../../modules/processing';
import type { WorkStore } from '../../modules/works';

export interface WorkStores {
  sessions: AgentSessionStore;
  works: WorkStore;
  facts: FactsStore;
  processing: WorkProcessingStore;
  generation: GenerationStore;
}
export interface WorkDependencies extends WorkStores {
  transaction<T>(operation: (stores: WorkStores) => Promise<T>): Promise<T>;
  documents: DocumentService;
  settings: LlmSettingsStore;
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
  agents: DocumentAgents;
  storage: SourceStorage;
  logger: Logger;
}
