import type { Database } from '@anyko/database';

type Connection = Pick<Database, 'workUploadGroup' | 'workDocument'>;

export function createUploadGroupsStore(db: Connection) {
  const where = (workspaceId: string, workId: string) => ({
    workspaceId,
    workId,
  });
  const groupDocuments = (workspaceId: string, workId: string, id: bigint) =>
    db.workDocument.findMany({
      where: {
        ...where(workspaceId, workId),
        uploadGroupId: id,
        removed: false,
        document: { deletedAt: null },
      },
      select: {
        ocrRevision: true,
        document: {
          select: {
            _count: { select: { runs: { where: { kind: 'document.ocr' } } } },
            runs: {
              where: {
                kind: 'document.ocr',
                status: { in: ['succeeded', 'failed', 'cancelled'] },
              },
              take: 1,
              select: { status: true },
            },
          },
        },
      },
    });
  // Attachment and maintenance serialize on the work row. A file's first terminal
  // recognition counts even if another attempt has already been requested.
  async function closeOpenUploadGroup(workspaceId: string, workId: string) {
    const open = await db.workUploadGroup.findFirst({
      where: { ...where(workspaceId, workId), closedAt: null },
      select: { id: true },
    });
    if (!open) return null;
    const documents = await groupDocuments(workspaceId, workId, open.id);
    if (
      documents.some(
        ({ ocrRevision, document }) =>
          ocrRevision === null &&
          document._count.runs > 0 &&
          !document.runs.length,
      )
    )
      return open.id;
    await db.workUploadGroup.update({
      where: { id: open.id },
      data: { closedAt: new Date() },
    });
    return null;
  }
  return {
    closeOpenUploadGroup,
    async joinUploadGroup(
      workspaceId: string,
      workId: string,
      actorId: string,
    ) {
      return (
        (await closeOpenUploadGroup(workspaceId, workId)) ??
        (
          await db.workUploadGroup.create({
            data: { ...where(workspaceId, workId), actorId },
            select: { id: true },
          })
        ).id
      );
    },
    pendingUploadWorks() {
      return db.workUploadGroup.findMany({
        where: { dispatchedAt: null, work: { deletedAt: null } },
        distinct: ['workspaceId', 'workId'],
        select: { workspaceId: true, workId: true },
      });
    },
    pendingUploadCount(workspaceId: string, workId: string) {
      return db.workDocument.count({
        where: {
          ...where(workspaceId, workId),
          removed: false,
          document: { deletedAt: null },
          uploadGroup: { is: { dispatchedAt: null } },
        },
      });
    },
    async readyUploadGroup(workspaceId: string, workId: string) {
      const group = await db.workUploadGroup.findFirst({
        where: { ...where(workspaceId, workId), dispatchedAt: null },
        orderBy: { id: 'asc' },
        select: { id: true, actorId: true, closedAt: true },
      });
      if (!group?.closedAt) return null;
      const documents = await groupDocuments(workspaceId, workId, group.id);
      const included = documents.some(({ ocrRevision }) => ocrRevision !== null)
        ? await db.workDocument.findMany({
            where: {
              ...where(workspaceId, workId),
              removed: false,
              ocrRevision: { not: null },
              document: { deletedAt: null },
              OR: [
                { uploadGroupId: null },
                { uploadGroupId: { lte: group.id } },
              ],
            },
            orderBy: { documentId: 'asc' },
            select: { documentId: true },
          })
        : [];
      return {
        id: group.id,
        actorId: group.actorId,
        documentIds: included.map(({ documentId }) => documentId),
      };
    },
    async dispatchUploadGroup(workspaceId: string, workId: string, id: bigint) {
      await db.workUploadGroup.update({
        where: { workspaceId_workId_id: { ...where(workspaceId, workId), id } },
        data: { dispatchedAt: new Date() },
      });
    },
    async unlinkPendingUpload(
      workspaceId: string,
      workId: string,
      documentId: string,
    ) {
      const result = await db.workDocument.deleteMany({
        where: {
          ...where(workspaceId, workId),
          documentId,
          removed: false,
          ocrRevision: null,
          uploadGroupId: { not: null },
        },
      });
      return result.count === 1;
    },
  };
}
