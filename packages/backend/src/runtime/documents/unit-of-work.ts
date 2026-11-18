import type { Database } from '@anyko/database';

import { record } from '../../modules/audit';
import type { DocumentStore } from '../../modules/documents';
import { createDocumentCommands } from '../../modules/documents/infrastructure/commands';
import { createDocumentReadModel } from '../../modules/documents/infrastructure/read-model';
import { redactResourceResponses } from '../../modules/idempotency/infrastructure/store';
import { createProcessingCommands } from '../../modules/processing/infrastructure/commands';
import {
  openTransaction,
  transactionHandle,
  type Tx,
} from '../../platform/transactions';

type DeletionTransaction = Parameters<typeof createDocumentCommands>[0] &
  Parameters<typeof createProcessingCommands>[0] &
  Parameters<typeof record>[0];

export async function requestDocumentDeletion(
  transaction: Tx,
  workspaceId: string,
  documentId: string,
  actorId: string,
) {
  const tx = transactionHandle<DeletionTransaction>(transaction);
  const commands = createDocumentCommands(tx);
  const exists = await commands.lock(workspaceId, documentId);
  if (!exists) return commands.isDeleted(workspaceId, documentId);
  await commands.markDeleted(workspaceId, documentId);
  await createProcessingCommands(tx).cancelDocument(workspaceId, documentId);
  await redactResourceResponses(transaction, workspaceId, [
    { kind: 'document', id: documentId },
  ]);
  await record(tx, {
    workspaceId,
    actorId,
    action: 'documents.deleted',
    target: { kind: 'document', id: documentId },
  });
  return true;
}

/** Binds module-owned commands to the same short database transaction. */
export function createDocumentUnitOfWork(db: Database): DocumentStore {
  const reads = createDocumentReadModel(db);
  const documents = createDocumentCommands(db);
  return {
    ...reads,
    assertUploadAllowed: (scope, key) =>
      documents.assertUploadAllowed(scope, key),
    forgetSource: (key) => documents.forgetSource(key),
    stageSource: (key, workspaceId) => documents.stageSource(key, workspaceId),
    remove: (workspaceId, documentId, actorId) =>
      db.$transaction((tx) =>
        requestDocumentDeletion(
          openTransaction(tx),
          workspaceId,
          documentId,
          actorId,
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
    async retry(workspaceId, documentId, actorId, correlationId) {
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
          document?.errorCode === 'OCR_RETRY_REQUIRED',
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
) {
  await db.$transaction(async (tx) => {
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
