import type { Database } from '@anyko/database';
import { fieldValuesSchema, generationSchema } from '@anyko/contracts';
import type { GenerationStore } from '..';

export function createGenerationStore(
  db: Pick<Database, 'workGeneration' | 'workArtifact'>,
): GenerationStore {
  return {
    async create(input) {
      await db.workGeneration.create({ data: input });
    },
    async get(workspaceId, workId, id) {
      const row = await db.workGeneration.findFirst({
        where: { workspaceId, workId, id },
      });
      return row
        ? { ...row, values: fieldValuesSchema.parse(row.values) }
        : null;
    },
    async list(workspaceId, workId) {
      return (
        await db.workGeneration.findMany({
          where: { workspaceId, workId },
          orderBy: { createdAt: 'desc' },
          take: 30,
        })
      ).map((row) =>
        generationSchema.parse({
          ...row,
          createdAt: row.createdAt.toISOString(),
        }),
      );
    },
    async publish(input) {
      await db.workGeneration.updateMany({
        where: {
          workspaceId: input.workspaceId,
          workId: input.workId,
          id: input.id,
        },
        data: { status: 'succeeded', key: input.key, checksum: input.checksum },
      });
    },
    async fail(workspaceId, id) {
      await db.workGeneration.updateMany({
        where: { workspaceId, id },
        data: { status: 'failed' },
      });
    },
    async stage(workspaceId, workId, key) {
      await db.workArtifact.create({ data: { workspaceId, workId, key } });
    },
    async keys(workspaceId, workId) {
      return (
        await db.workArtifact.findMany({
          where: { workspaceId, workId },
          select: { key: true },
        })
      ).map((row) => row.key);
    },
    async erase(workspaceId, workId) {
      await db.workGeneration.deleteMany({ where: { workspaceId, workId } });
      await db.workArtifact.deleteMany({ where: { workspaceId, workId } });
    },
  };
}
