import type { Database } from '@anyko/database';
import type { DocumentIo } from '../application/ports';
import { StorageWriteOutcomeUnknown } from '../application/ports';
export function createDocumentIo(db: Database): DocumentIo {
  return {
    async run(input, operation) {
      const id = crypto.randomUUID();
      await db.documentIo.create({ data: { id, ...input } });
      let uncertain = false;
      try {
        return await operation();
      } catch (error) {
        uncertain = error instanceof StorageWriteOutcomeUnknown;
        throw error;
      } finally {
        if (uncertain)
          await db.documentIo.update({
            where: { id },
            data: { uncertain: true },
          });
        else await db.documentIo.deleteMany({ where: { id } });
      }
    },
  };
}
