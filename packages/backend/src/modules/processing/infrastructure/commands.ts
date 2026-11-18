import type { Database } from '@anyko/database';

import { uuidV7 } from '../../../platform/ids';
import { nextRunRevision } from '../domain/retry';
type Connection = Pick<Database, 'run' | 'runAttempt' | 'resultUpload'>;
interface Start {
  runId: string;
  workspaceId: string;
  documentId: string;
  actorId: string;
  correlationId: string;
}
export function createProcessingCommands(db: Connection) {
  async function start(input: Start, revision = 1) {
    await db.run.create({
      data: {
        id: input.runId,
        kind: 'document.ocr',
        workspaceId: input.workspaceId,
        documentId: input.documentId,
        initiatedBy: input.actorId,
        correlationId: input.correlationId,
        revision,
        outbox: { create: { id: uuidV7() } },
      },
    });
  }
  return {
    start,
    async eraseDocument(
      workspaceId: string,
      documentId: string,
      keys: string[],
    ) {
      await db.run.deleteMany({ where: { workspaceId, documentId } });
      await db.runAttempt.deleteMany({
        where: { workspaceId, documentId },
      });
      await db.resultUpload.deleteMany({
        where: { workspaceId, key: { in: keys } },
      });
    },
    async cancelDocument(workspaceId: string, documentId: string) {
      await db.run.updateMany({
        where: {
          workspaceId,
          documentId,
          status: { in: ['queued', 'running'] },
        },
        data: {
          status: 'failed',
          errorCode: 'DOCUMENT_DELETED',
          attemptToken: null,
          leaseUntil: null,
        },
      });
    },
    async retry(input: Omit<Start, 'runId'>, replaceSucceeded = false) {
      const previous = await db.run.findFirst({
        where: { workspaceId: input.workspaceId, documentId: input.documentId },
        orderBy: { revision: 'desc' },
      });
      const revision = nextRunRevision(
        previous?.revision === null
          ? null
          : previous && { ...previous, revision: previous.revision },
        replaceSucceeded,
      );
      if (revision === null) return false;
      await start({ ...input, runId: uuidV7() }, revision);
      return true;
    },
  };
}
