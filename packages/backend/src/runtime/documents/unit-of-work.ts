import type { Database } from '@anyko/database';

import type { DocumentStore } from '../../modules/documents';
import { createDocumentCommands } from '../../modules/documents/infrastructure/commands';
import { createDocumentReadModel } from '../../modules/documents/infrastructure/read-model';
import { createProcessingCommands } from '../../modules/processing/infrastructure/commands';
import { eraseWorkAgentThreads } from '../../modules/processing/infrastructure/work-store';
import { createCatalogWorkLinks } from '../../modules/works/infrastructure/catalog-sources';
import type { ResolveWorkPackage } from '../../workflows/work-package';

import {
  readCatalogDeletionImpact,
  requestCatalogDeletion,
} from './catalog-deletion';

/** Binds module-owned commands to the same short database transaction. */
export function createDocumentUnitOfWork(
  db: Database,
  resolvePackage: ResolveWorkPackage,
): DocumentStore {
  const reads = createDocumentReadModel(db);
  const documents = createDocumentCommands(db);
  const links = createCatalogWorkLinks(db);
  return {
    ...reads,
    linkedWorks: (workspaceId, documentIds) =>
      links.listForDocuments(workspaceId, documentIds),
    assertUploadAllowed: (scope, key) =>
      documents.assertUploadAllowed(scope, key),
    forgetSource: (key) => documents.forgetSource(key),
    stageSource: (key, workspaceId) => documents.stageSource(key, workspaceId),
    deletionImpact: (workspaceId, documentId) =>
      readCatalogDeletionImpact(db, workspaceId, documentId),
    remove: (workspaceId, documentId, actorId, confirmation) =>
      db.$transaction((tx) =>
        requestCatalogDeletion(
          tx,
          resolvePackage,
          workspaceId,
          documentId,
          actorId,
          confirmation,
        ),
      ),
    async register(input) {
      let documentId = input.id;
      try {
        await db.$transaction(async (tx) => {
          await createDocumentCommands(tx).registerSource(input);
          await createProcessingCommands(tx).start({
            runId: input.runId,
            workspaceId: input.workspaceId,
            documentId: input.id,
            actorId: input.actorId,
            correlationId: input.correlationId,
          });
        });
      } catch (error) {
        const existing = await documents.resolveExisting(input, error);
        if (!existing) throw error;
        documentId = existing;
      }
      const found = await reads.get(input.workspaceId, documentId);
      if (!found) throw new Error('REGISTERED_DOCUMENT_MISSING');
      return found;
    },
    async retry(
      workspaceId,
      documentId,
      actorId,
      correlationId,
      replaceSucceeded,
    ) {
      const retried = await db.$transaction(async (tx) => {
        const exists = await createDocumentCommands(tx).lock(
          workspaceId,
          documentId,
        );
        if (!exists) return false;
        const document = await createDocumentReadModel(tx).get(
          workspaceId,
          documentId,
        );
        return createProcessingCommands(tx).retry(
          { workspaceId, documentId, actorId, correlationId },
          replaceSucceeded || document?.errorCode === 'OCR_RETRY_REQUIRED',
        );
      });
      return retried ? reads.get(workspaceId, documentId) : null;
    },
  };
}
export async function finishDocumentDeletion(
  db: Database,
  workspaceId: string,
  documentId: string,
  keys: string[],
  threadIds: string[],
) {
  await db.$transaction(async (tx) => {
    const links = createCatalogWorkLinks(tx);
    await links.assertNoLiveLinks(workspaceId, documentId);
    // Links of deleted works still refer to both the source and its OCR revision.
    await links.purgeDeletedWorkLinks(workspaceId, documentId);
    await eraseWorkAgentThreads(tx, workspaceId, threadIds);
    await createProcessingCommands(tx).eraseDocument(
      workspaceId,
      documentId,
      keys,
    );
    await createDocumentCommands(tx).finishDeletion(
      workspaceId,
      documentId,
      keys,
    );
  });
}
