import type { Database } from '@anyko/database';
import type { SourceStorage } from '../application/ports';
export function createSourceCleanup(db: Database, storage: SourceStorage) {
  return async (before: Date) => {
    const staged = await db.sourceUpload.findMany({
      where: { createdAt: { lt: before } },
      take: 20,
    });
    for (const item of staged) {
      const owner = await db.sourceDocument.findUnique({
        where: { sourceKey: item.key },
        select: { id: true },
      });
      if (!owner) await storage.delete(item.key);
      await db.sourceUpload.deleteMany({ where: { key: item.key } });
    }
  };
}
