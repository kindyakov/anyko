import type { Database } from '@anyko/database';
import { nextRunRevision } from '../domain/retry';
type Connection = Pick<
  Database,
  'processingRun' | 'processorAttempt' | 'resultUpload'
>;
interface Start {
  runId: string;
  workspaceId: string;
  documentId: string;
  actorId: string;
  correlationId: string;
}
export function createProcessingCommands(db: Connection) {
  async function start(input: Start, revision = 1) {
    await db.processingRun.create({
      data: {
        id: input.runId,
        workspaceId: input.workspaceId,
        documentId: input.documentId,
        initiatedBy: input.actorId,
        correlationId: input.correlationId,
        revision,
        outbox: { create: { id: crypto.randomUUID() } },
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
      await db.processingRun.deleteMany({ where: { workspaceId, documentId } });
      await db.processorAttempt.deleteMany({
        where: { workspaceId, documentId },
      });
      await db.resultUpload.deleteMany({
        where: { workspaceId, key: { in: keys } },
      });
    },
    async cancelDocument(workspaceId: string, documentId: string) {
      await db.processingRun.updateMany({
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
    async retry(input: Omit<Start, 'runId'>) {
      const previous = await db.processingRun.findFirst({
        where: { workspaceId: input.workspaceId, documentId: input.documentId },
        orderBy: { revision: 'desc' },
      });
      const revision = nextRunRevision(previous);
      if (revision === null) return false;
      await start({ ...input, runId: crypto.randomUUID() }, revision);
      return true;
    },
  };
}
