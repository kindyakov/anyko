import type { Database } from '@anyko/database';

import { StorageWriteOutcomeUnknown } from '../../../platform/storage-write-outcome';
import type { ProcessingIo } from '../application/io';

/** Persist before writing; uncertain storage outcomes leave a barrier for operator recovery. */
export function createProcessingIo(
  db: Pick<Database, 'processingIo'>,
  newId: () => string,
): ProcessingIo {
  return {
    async run(subject, operation) {
      const id = newId();
      await db.processingIo.create({ data: { ...subject, id } });
      let uncertain = false;
      try {
        return await operation();
      } catch (error) {
        uncertain = error instanceof StorageWriteOutcomeUnknown;
        throw error;
      } finally {
        if (uncertain)
          await db.processingIo.update({
            where: { id },
            data: { uncertain: true },
          });
        else await db.processingIo.deleteMany({ where: { id } });
      }
    },
    async clean(workspaceId, workId) {
      return (
        (await db.processingIo.count({
          where: { kind: 'work', workspaceId, workId, uncertain: true },
        })) === 0
      );
    },
    async assertIdle(workspaceId, workId) {
      if (
        await db.processingIo.count({
          where: { kind: 'work', workspaceId, workId },
        })
      )
        throw new Error('WORK_WRITERS_ACTIVE');
    },
  };
}
