import {
  createDatabase,
  createResourceLocks,
  type Database,
} from '@anyko/database';
import type { Logger } from '@anyko/logger';
import type { SourceStorage } from '../../modules/documents';
import type { DocumentAgents } from '../../modules/agents';
import { createDocumentAgents } from '../../modules/agents/infrastructure/mastra';
import { createDocumentRuntime } from '../documents/api';
import { createDocumentIo } from '../../modules/documents/infrastructure/document-io';
import { createDeletionStore } from '../../modules/documents/infrastructure/deletion-store';
import { createAgentSessionStore } from '../../modules/agents/infrastructure/session-store';
import { createWorkStore } from '../../modules/works/infrastructure/store';
import { createWorkIo } from '../../modules/works/infrastructure/work-io';
import { createFactsStore } from '../../modules/facts/infrastructure/store';
import { createGenerationStore } from '../../modules/generation/infrastructure/store';
import { createWorkProcessingStore } from '../../modules/processing/infrastructure/work-store';
import { createLlmSettingsStore } from '../../modules/processing/infrastructure/settings-store';
import { createWorkApi } from '../../workflows/works/api';
import type { WorkStores, WorkDependencies } from '../../workflows/works/ports';

type StoreConnection = Pick<
  Database,
  | 'work'
  | 'workDocument'
  | 'workEvent'
  | 'workFacts'
  | 'workGeneration'
  | 'workGenerationFile'
  | 'workArtifact'
  | 'workRun'
  | 'workStep'
  | 'workOutbox'
  | 'workAgentThread'
  | 'workAgentSession'
  | 'workAgentTurn'
  | '$executeRaw'
>;
function stores(db: StoreConnection): WorkStores {
  return {
    sessions: createAgentSessionStore(db),
    works: createWorkStore(db),
    facts: createFactsStore(db),
    generation: createGenerationStore(db),
    processing: createWorkProcessingStore(db),
  };
}
export interface WorkRuntimeOptions {
  databaseUrl: string;
  encryptionKey: string;
  storage: SourceStorage;
  logger: Logger;
  agents?: DocumentAgents;
}
export function createWorkRuntime(options: WorkRuntimeOptions) {
  const db = createDatabase(options.databaseUrl);
  const locks = createResourceLocks(options.databaseUrl);
  const documents = createDocumentRuntime(options);
  let delegate: DocumentAgents | undefined = options.agents;
  const agents = () =>
    (delegate ??= createDocumentAgents({ databaseUrl: options.databaseUrl }));
  const deps: WorkDependencies = {
    ...stores(db),
    transaction: (operation) => db.$transaction((tx) => operation(stores(tx))),
    documents,
    settings: createLlmSettingsStore(db, options.encryptionKey),
    locks,
    documentIo: createDocumentIo(db),
    workIo: createWorkIo(db),
    assertNoDocumentWriters: (workspaceId, documentId, requestKey) =>
      createDeletionStore(db).assertNoWriters(
        workspaceId,
        documentId,
        requestKey,
      ),
    agents: {
      ready: () => agents().ready(),
      describe: (input) => agents().describe(input),
      extract: (input) => agents().extract(input),
      reconcile: (input) => agents().reconcile(input),
      eraseThread: (id) => agents().eraseThread(id),
      stop: async () => {
        await delegate?.stop();
      },
    },
    storage: options.storage,
    logger: options.logger,
  };
  return {
    api: createWorkApi(deps),
    deps,
    settings: deps.settings,
    saveSettings: (
      workspaceId: string,
      input: Parameters<typeof deps.settings.save>[1],
    ) =>
      locks.run(`llm-settings:${workspaceId}`, () =>
        deps.settings.save(workspaceId, input),
      ),
    async ready() {
      await documents.ready();
    },
    async stop() {
      await deps.agents.stop();
      await documents.stop();
      await locks.stop();
      await db.$disconnect();
    },
  };
}
