import type { Database } from '@anyko/database';
import type { DocumentStore } from '../application/ports';
import { DocumentError } from '../application/service';
type Connection = Pick<
  Database,
  | 'sourceDocument'
  | 'sourceUpload'
  | 'documentArtifact'
  | 'documentDeletion'
  | '$queryRaw'
>;
type Registration = Parameters<DocumentStore['register']>[0];
export function createDocumentCommands(db: Connection) {
  return {
    async forgetSource(key: string) {
      await db.sourceUpload.deleteMany({ where: { key } });
    },
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
        (existing.deletedAt ||
          existing.sourceChecksum !== input.sourceChecksum ||
          existing.filename !== input.filename)
      )
        throw new DocumentError('IDEMPOTENCY_CONFLICT', { cause });
      return existing?.id ?? null;
    },
    async lock(workspaceId: string, documentId: string) {
      const rows = await db.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "SourceDocument" WHERE id=${documentId} AND "workspaceId"=${workspaceId} AND "deletedAt" IS NULL FOR UPDATE`;
      return rows.length === 1;
    },
    async markDeleted(workspaceId: string, documentId: string) {
      const document = await db.sourceDocument.findFirstOrThrow({
        where: { workspaceId, id: documentId },
      });
      await db.documentDeletion.upsert({
        where: { id: documentId },
        create: {
          id: documentId,
          workspaceId,
          requestKey: document.requestKey,
        },
        update: {},
      });
      const result = await db.sourceDocument.updateMany({
        where: { workspaceId, id: documentId },
        data: { deletedAt: new Date() },
      });
      return result.count === 1;
    },
    async isDeleted(workspaceId: string, documentId: string) {
      return (
        (await db.documentDeletion.count({
          where: { workspaceId, id: documentId },
        })) === 1
      );
    },
    async assertUploadAllowed(workspaceId: string, requestKey: string) {
      if (
        await db.documentDeletion.count({ where: { workspaceId, requestKey } })
      )
        throw new DocumentError('IDEMPOTENCY_CONFLICT');
    },
    async finishDeletion(
      workspaceId: string,
      documentId: string,
      keys: string[],
    ) {
      await db.documentArtifact.deleteMany({
        where: { workspaceId, key: { in: keys } },
      });
      await db.sourceUpload.deleteMany({
        where: { workspaceId, key: { in: keys } },
      });
      await db.sourceDocument.deleteMany({
        where: { workspaceId, id: documentId },
      });
      await db.documentDeletion.updateMany({
        where: { workspaceId, id: documentId },
        data: { completedAt: new Date() },
      });
    },
  };
}
