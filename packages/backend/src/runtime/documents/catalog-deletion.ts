import type { Database } from '@anyko/database';

import { createAgentSessionStore } from '../../modules/agents/infrastructure/session-store';
import { record } from '../../modules/audit';
import type { DocumentDeletionConfirmation } from '../../modules/documents';
import { createDocumentCommands } from '../../modules/documents/infrastructure/commands';
import { createDocumentReadModel } from '../../modules/documents/infrastructure/read-model';
import {
  createFactsStore,
  factsStoreFor,
} from '../../modules/facts/infrastructure/store';
import { createFactsModule } from '../../modules/facts/module';
import { createSourceWorkProcessing } from '../../modules/processing/infrastructure/catalog-sources';
import { createProcessingCommands } from '../../modules/processing/infrastructure/commands';
import { createWorkProcessingStore } from '../../modules/processing/infrastructure/work-store';
import { createCatalogWorkLinks } from '../../modules/works/infrastructure/catalog-sources';
import { createWorkStore } from '../../modules/works/infrastructure/store';
import { uuidV7 } from '../../platform/ids';
import { openTransaction } from '../../platform/transactions';
import {
  deleteCatalogDocument,
  readDeletionImpact,
} from '../../workflows/catalog-document-deletion';
import { redactDeletedDocumentResponses } from '../works/idempotency';

type DeletionRead = Pick<
  Database,
  | 'sourceDocument'
  | 'documentDeletion'
  | 'processingIo'
  | 'documentArtifact'
  | '$queryRaw'
  | 'workDocument'
  | 'run'
  | 'runStep'
>;
function impactPorts(db: DeletionRead) {
  const links = createCatalogWorkLinks(db);
  const processing = createSourceWorkProcessing(db);
  const documents = createDocumentReadModel(db);
  return {
    exists: (workspaceId: string, documentId: string) =>
      documents.exists(workspaceId, documentId),
    async affectedWorks(workspaceId: string, documentId: string) {
      const works = await links.list(workspaceId, documentId);
      const busy = await processing.activeWorks(
        workspaceId,
        works.map(({ id }) => id),
      );
      return works.map((work) => ({ ...work, busy: busy.has(work.id) }));
    },
  };
}

export function readCatalogDeletionImpact(
  db: DeletionRead,
  workspaceId: string,
  documentId: string,
) {
  return readDeletionImpact(impactPorts(db), workspaceId, documentId);
}

type DeletionTransaction = Omit<
  Database,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

export function requestCatalogDeletion(
  tx: DeletionTransaction,
  workspaceId: string,
  documentId: string,
  actorId: string,
  confirmation?: DocumentDeletionConfirmation,
) {
  const documents = createDocumentCommands(tx);
  const links = createCatalogWorkLinks(tx);
  const processing = createSourceWorkProcessing(tx);
  const commands = createProcessingCommands(tx);
  const { threads } = createWorkProcessingStore(tx);
  const sessions = createAgentSessionStore(tx, uuidV7);
  const ports: Parameters<typeof deleteCatalogDocument>[0] = {
    ...impactPorts(tx),
    lockSource: (workspaceId, documentId) =>
      documents.lock(workspaceId, documentId),
    isDeleted: (workspaceId, documentId) =>
      documents.isDeleted(workspaceId, documentId),
    async tryWorkLock(key: string) {
      const [result] = await tx.$queryRaw<{ locked: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(hashtextextended(${key}, 0)) AS locked
      `;
      return result?.locked === true;
    },
    unlink: (workspaceId, documentId, workIds) =>
      links.unlink(workspaceId, documentId, workIds),
    eraseSteps: (workspaceId, documentId, workIds) =>
      processing.eraseSteps(workspaceId, documentId, workIds),
    facts: createFactsModule({
      store: createFactsStore(tx),
      storeFor: factsStoreFor,
    }).internal,
    works: createWorkStore(tx),
    eraseSession: (workspaceId, workId) => sessions.erase(workspaceId, workId),
    threads,
    markDeleted: (workspaceId, documentId, threadIds) =>
      documents.markDeleted(workspaceId, documentId, threadIds),
    cancelDocument: (workspaceId, documentId) =>
      commands.cancelDocument(workspaceId, documentId),
    redactResponses: (workspaceId: string, documentId: string) =>
      redactDeletedDocumentResponses(
        openTransaction(tx),
        workspaceId,
        documentId,
      ),
    recordDeletion: (
      workspaceId: string,
      documentId: string,
      actorId: string,
    ) =>
      record(tx, {
        workspaceId,
        actorId,
        action: 'documents.deleted',
        target: { kind: 'document', id: documentId },
      }),
  };
  return deleteCatalogDocument(
    ports,
    workspaceId,
    documentId,
    actorId,
    confirmation,
  );
}
