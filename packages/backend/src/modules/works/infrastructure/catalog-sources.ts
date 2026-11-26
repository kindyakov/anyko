import type { Database } from '@anyko/database';

export function createCatalogWorkLinks(db: Pick<Database, 'workDocument'>) {
  return {
    async listForDocuments(workspaceId: string, documentIds: string[]) {
      const links = await db.workDocument.findMany({
        where: {
          workspaceId,
          documentId: { in: documentIds },
          removed: false,
          work: { deletedAt: null },
        },
        orderBy: [{ work: { title: 'asc' } }, { workId: 'asc' }],
        select: {
          documentId: true,
          work: { select: { id: true, title: true } },
        },
      });
      const byDocument = new Map<string, { id: string; title: string }[]>();
      for (const { documentId, work } of links) {
        const group = byDocument.get(documentId);
        if (group) group.push(work);
        else byDocument.set(documentId, [work]);
      }
      return byDocument;
    },
    async list(workspaceId: string, documentId: string) {
      const links = await db.workDocument.findMany({
        where: {
          workspaceId,
          documentId,
          removed: false,
          work: { deletedAt: null },
        },
        orderBy: { workId: 'asc' },
        select: {
          work: {
            select: {
              id: true,
              title: true,
              revision: true,
              confirmedRevision: true,
              packageVersion: true,
            },
          },
        },
      });
      return links.map(({ work }) => work);
    },
    async unlink(workspaceId: string, documentId: string, workIds: string[]) {
      await db.workDocument.deleteMany({
        where: {
          workspaceId,
          documentId,
          workId: { in: workIds },
          removed: false,
        },
      });
    },
    async purgeDeletedWorkLinks(workspaceId: string, documentId: string) {
      await db.workDocument.deleteMany({
        where: { workspaceId, documentId, work: { deletedAt: { not: null } } },
      });
    },
    async assertNoLiveLinks(workspaceId: string, documentId: string) {
      // A removed link is the work cleanup marker until its derived data is erased.
      if (
        await db.workDocument.count({
          where: { workspaceId, documentId, work: { deletedAt: null } },
        })
      )
        throw new Error('WORK_SOURCE_CLEANUP_PENDING');
    },
  };
}
