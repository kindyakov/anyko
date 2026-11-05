import type { Database } from '@anyko/database';
import {
  readFieldValues,
  generationSchema,
  generationFileSchema,
} from '@anyko/contracts';
import { z } from 'zod';
import type { GenerationStore } from '..';

export function createGenerationStore(
  db: Pick<Database, 'workGeneration' | 'workGenerationFile' | 'workArtifact'>,
): GenerationStore {
  return {
    async create(input) {
      const { files, ...record } = input;
      await db.workGeneration.create({ data: record });
      await db.workGenerationFile.createMany({
        data: files.map((file) => ({
          ...file,
          workspaceId: input.workspaceId,
          workId: input.workId,
          generationId: input.id,
          packageVersion: input.packageVersion,
        })),
      });
    },
    async get(workspaceId, workId, id) {
      const row = await db.workGeneration.findFirst({
        where: { workspaceId, workId, id },
        include: { files: { orderBy: { filename: 'asc' } } },
      });
      return row
        ? {
            ...row,
            values: readFieldValues(row.values),
            files: row.files.map((file) =>
              generationFileSchema
                .extend({
                  key: z.string().nullable(),
                  checksum: z.string().nullable(),
                })
                .parse(file),
            ),
          }
        : null;
    },
    async list(workspaceId, workId) {
      return (
        await db.workGeneration.findMany({
          where: { workspaceId, workId },
          orderBy: { createdAt: 'desc' },
          take: 30,
          include: { files: { orderBy: { filename: 'asc' } } },
        })
      ).map((row) =>
        generationSchema.parse({
          ...row,
          createdAt: row.createdAt.toISOString(),
        }),
      );
    },
    async publish(input) {
      await db.workGenerationFile.updateMany({
        where: {
          workspaceId: input.workspaceId,
          workId: input.workId,
          generationId: input.id,
          id: input.fileId,
        },
        data: { status: 'succeeded', key: input.key, checksum: input.checksum },
      });
    },
    async failFile(workspaceId, generationId, fileId) {
      await db.workGenerationFile.updateMany({
        where: { workspaceId, generationId, id: fileId, status: 'queued' },
        data: { status: 'failed', errorCode: 'DOCUMENT_GENERATION_FAILED' },
      });
    },
    async finish(workspaceId, id, status) {
      await db.workGeneration.updateMany({
        where: { workspaceId, id },
        data: { status },
      });
    },
    async fail(workspaceId, id) {
      await db.workGeneration.updateMany({
        where: { workspaceId, id },
        data: { status: 'failed' },
      });
      await db.workGenerationFile.updateMany({
        where: { workspaceId, generationId: id, status: 'queued' },
        data: { status: 'failed', errorCode: 'GENERATION_INTERRUPTED' },
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
