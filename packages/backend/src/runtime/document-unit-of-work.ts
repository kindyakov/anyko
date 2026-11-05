import type { Database } from '@anyko/database';
import type { DocumentStore } from '../modules/documents';
import { createDocumentReadModel } from '../modules/documents/infrastructure/read-model';
import { createDocumentCommands } from '../modules/documents/infrastructure/commands';
import { createProcessingCommands } from '../modules/processing/infrastructure/commands';

/** Binds module-owned commands to the same short database transaction. */
export function createDocumentUnitOfWork(db: Database): DocumentStore {
  const reads = createDocumentReadModel(db);
  const documents = createDocumentCommands(db);
  return {
    ...reads,
    stageSource: (key, workspaceId) => documents.stageSource(key, workspaceId),
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
        return createProcessingCommands(tx).retry({
          workspaceId,
          documentId,
          actorId,
          correlationId,
        });
      });
      return retried ? reads.get(workspaceId, documentId) : null;
    },
  };
}
