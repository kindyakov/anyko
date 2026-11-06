import type { Database } from '@anyko/database';
import { StorageWriteOutcomeUnknown } from '../../documents';

/** Durable write barrier; uncertain PUT outcomes require operator recovery. */
export function createWorkIo(db: Database) {
  return {
    async run<T>(
      workspaceId: string,
      workId: string,
      operation: () => Promise<T>,
    ): Promise<T> {
      const id = crypto.randomUUID();
      await db.workIo.create({ data: { id, workspaceId, workId } });
      let uncertain = false;
      try {
        return await operation();
      } catch (error) {
        uncertain = error instanceof StorageWriteOutcomeUnknown;
        throw error;
      } finally {
        if (uncertain)
          await db.workIo.update({ where: { id }, data: { uncertain: true } });
        else await db.workIo.deleteMany({ where: { id } });
      }
    },
    async clean(workspaceId: string, workId: string) {
      return (
        (await db.workIo.count({
          where: { workspaceId, workId, uncertain: true },
        })) === 0
      );
    },
    async assertIdle(workspaceId: string, workId: string) {
      if (await db.workIo.count({ where: { workspaceId, workId } }))
        throw new Error('WORK_WRITERS_ACTIVE');
    },
  };
}
