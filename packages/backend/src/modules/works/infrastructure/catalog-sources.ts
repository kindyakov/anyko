import type { Database } from '@anyko/database';

export function createCatalogWorkLinks(db: Pick<Database, 'workDocument'>) {
  return {
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
  };
}
