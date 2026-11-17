import type { Logger } from '@anyko/logger';

import type { AgentSessionStore, DocumentAgents } from '../../modules/agents';
import type { AuditSink } from '../../modules/audit';
import type {
  DocumentIo,
  DocumentsModule,
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
  // Журнал привязан к той же транзакции, что и действие сценария.
  audit: AuditSink;
}
export interface WorkDependencies extends WorkStores {
  // Мост до этапа 5b: процессы execute/continue-session/cleanup ещё работают с наборами хранилищ.
  // Реализация в runtime — uow.run(tx => операция с хранилищами storeFor(tx)); сценарии 5a используют
  // module.in(tx) и UnitOfWork напрямую.
  transaction<T>(operation: (stores: WorkStores) => Promise<T>): Promise<T>;
  documents: DocumentsModule;
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
