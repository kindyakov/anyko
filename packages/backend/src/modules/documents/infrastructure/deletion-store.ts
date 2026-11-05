import type { Database } from '@anyko/database';

export function createDeletionStore(db: Database) {
  return {
    async assertNoWriters(
      workspaceId: string,
      documentId: string,
      requestKey: string,
    ) {
      if (
        await db.documentIo.count({
          where: { workspaceId, OR: [{ documentId }, { requestKey }] },
        })
      )
        throw new Error('DOCUMENT_WRITES_PENDING');
    },
    pending: () =>
      db.documentDeletion.findMany({
        where: { completedAt: null },
        orderBy: { createdAt: 'asc' },
        take: 20,
        select: { id: true, workspaceId: true, requestKey: true },
      }),
    async keys(workspaceId: string, documentId: string, requestKey: string) {
      const rows = await db.documentArtifact.findMany({
        where: { workspaceId, OR: [{ documentId }, { requestKey }] },
        select: { key: true },
      });
      const source = await db.sourceDocument.findFirst({
        where: { workspaceId, id: documentId },
        select: { sourceKey: true },
      });
      return [
        ...new Set([
          ...rows.map((row) => row.key),
          ...(source ? [source.sourceKey] : []),
        ]),
      ];
    },
  };
}
