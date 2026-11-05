import type { Database } from '@anyko/database';
import type { DocumentStore } from '../application/ports';
import { DocumentError } from '../application/service';
type Connection = Pick<
  Database,
  'sourceDocument' | 'sourceUpload' | '$queryRaw'
>;
type Registration = Parameters<DocumentStore['register']>[0];
export function createDocumentCommands(db: Connection) {
  return {
    async stageSource(key: string, workspaceId: string) {
      await db.sourceUpload.create({ data: { key, workspaceId } });
    },
    async registerSource(input: Registration) {
      await db.sourceDocument.create({
        data: {
          id: input.id,
          workspaceId: input.workspaceId,
          filename: input.filename,
          sourceKey: input.sourceKey,
          sourceChecksum: input.sourceChecksum,
          size: input.size,
          createdBy: input.actorId,
          requestKey: input.requestKey,
        },
      });
      await db.sourceUpload.delete({ where: { key: input.sourceKey } });
    },
    async resolveExisting(input: Registration, cause: unknown) {
      const existing = await db.sourceDocument.findUnique({
        where: {
          workspaceId_requestKey: {
            workspaceId: input.workspaceId,
            requestKey: input.requestKey,
          },
        },
      });
      if (
        existing &&
        (existing.sourceChecksum !== input.sourceChecksum ||
          existing.filename !== input.filename)
      )
        throw new DocumentError('IDEMPOTENCY_CONFLICT', { cause });
      return existing?.id ?? null;
    },
    async lock(workspaceId: string, documentId: string) {
      const rows = await db.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "SourceDocument" WHERE id=${documentId} AND "workspaceId"=${workspaceId} FOR UPDATE`;
      return rows.length === 1;
    },
  };
}
