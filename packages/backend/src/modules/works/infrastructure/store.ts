import { workSummarySchema } from '@anyko/contracts';
import type { Database } from '@anyko/database';

import type { WorkStore } from '..';

type Connection = Pick<Database, 'work' | 'workDocument' | 'workEvent'>;
export function createWorkStore(db: Connection): WorkStore {
  const summary = (row: {
    id: string;
    title: string;
    packageVersion: string;
    revision: number;
    inputRevision: number;
    confirmedRevision: number | null;
    createdAt: Date;
    updatedAt: Date;
  }) =>
    workSummarySchema.parse({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  return {
    async list(workspaceId, after) {
      return (
        await db.work.findMany({
          where: { workspaceId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 51,
          ...(after ? { cursor: { id: after }, skip: 1 } : {}),
        })
      ).map(summary);
    },
    async get(workspaceId, id) {
      const row = await db.work.findFirst({ where: { workspaceId, id } });
      return row ? summary(row) : null;
    },
    async create(input) {
      await db.work.create({
        data: {
          id: input.id,
          workspaceId: input.workspaceId,
          title: input.title,
          packageVersion: input.packageVersion,
          createdBy: input.actorId,
        },
      });
    },
    async attach(workspaceId, workId, documentId) {
      const row = await db.workDocument.upsert({
        where: { documentId },
        create: { workspaceId, workId, documentId },
        update: {},
      });
      if (row.workspaceId !== workspaceId || row.workId !== workId)
        throw new Error('DOCUMENT_ALREADY_ATTACHED');
    },
    async documents(workspaceId, workId) {
      return (
        await db.workDocument.findMany({
          where: { workspaceId, workId },
          include: { document: true },
          orderBy: { documentId: 'asc' },
        })
      ).map(({ document }) => ({
        id: document.id,
        filename: document.filename,
        sourceKey: document.sourceKey,
        requestKey: document.requestKey,
        deleted: document.deletedAt !== null,
      }));
    },
    async touch(workspaceId, id, input) {
      const row = await db.work.findFirstOrThrow({
        where: { workspaceId, id },
      });
      await db.work.update({
        where: { workspaceId_id: { workspaceId, id } },
        data: {
          revision: { increment: 1 },
          ...(input.inputChanged ? { inputRevision: { increment: 1 } } : {}),
          confirmedRevision: input.confirmed ? row.revision + 1 : null,
        },
      });
    },
    async event(workspaceId, workId, kind) {
      await db.workEvent.create({ data: { workspaceId, workId, kind } });
    },
    async events(workspaceId, workId, after) {
      return (
        await db.workEvent.findMany({
          where: { workspaceId, workId, id: { gt: BigInt(after) } },
          orderBy: { id: 'asc' },
          take: 100,
        })
      ).map((row) => ({ id: row.id.toString(), kind: row.kind }));
    },
    async cursor(workspaceId, workId) {
      return (
        (
          await db.workEvent.findFirst({
            where: { workspaceId, workId },
            orderBy: { id: 'desc' },
          })
        )?.id.toString() ?? '0'
      );
    },
    async dirty() {
      return db.work
        .findMany({
          where: {
            documents: { some: { document: { deletedAt: { not: null } } } },
          },
          select: { workspaceId: true, id: true },
          take: 20,
        })
        .then((rows) =>
          rows.map((row) => ({ workspaceId: row.workspaceId, workId: row.id })),
        );
    },
    async detachDeleted(workspaceId, workId) {
      await db.workDocument.deleteMany({
        where: { workspaceId, workId, document: { deletedAt: { not: null } } },
      });
    },
  };
}
