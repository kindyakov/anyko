import type { Database } from '@anyko/database';

import type { SourceStorage } from '../application/ports';
export function createSourceCleanup(db: Database, storage: SourceStorage) {
  return async (before: Date) => {
    // Keep the key registered while a writer may still publish bytes to it.
    const staged = await db.$queryRaw<{ key: string }[]>`
      SELECT upload.key
      FROM "SourceUpload" upload
      WHERE upload."createdAt" < ${before}
        AND NOT EXISTS (
          SELECT 1
          FROM "DocumentArtifact" artifact
          JOIN "ProcessingIo" writer
            ON writer."workspaceId" = artifact."workspaceId"
            AND writer."documentId" = artifact."documentId"
            AND writer.kind = 'document'
          WHERE artifact.key = upload.key
            AND artifact."workspaceId" = upload."workspaceId"
        )
      ORDER BY upload."createdAt"
      LIMIT 20
    `;
    for (const item of staged) {
      const owner = await db.sourceDocument.findUnique({
        where: { sourceKey: item.key },
        select: { id: true },
      });
      if (!owner) {
        await storage.delete(item.key);
        await db.documentArtifact.deleteMany({ where: { key: item.key } });
      }
      await db.sourceUpload.deleteMany({ where: { key: item.key } });
    }
  };
}
