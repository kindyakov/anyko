import type { Database } from '@anyko/database';

import { workSummarySchema } from '..';
import type { WorkStore } from '..';
import { transactionHandle, type Tx } from '../../../platform/transactions';

import { createWorkDeletionStore } from './deletion-store';

type Connection = Pick<
  Database,
  'work' | 'workDocument' | 'workEvent' | 'workDeletion'
>;
// Хранилище внутри транзакции действия: токен превращается в клиент транзакции драйвера.
export function worksStoreFor(tx: Tx): WorkStore {
  return createWorkStore(transactionHandle<Connection>(tx));
}
export function createWorkStore(
  db: Connection & Partial<Pick<Database, '$transaction'>>,
): WorkStore {
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
    ...createWorkDeletionStore(db),
    async list(workspaceId, { q, status, page, pageSize }) {
      const revision = db.work.fields.revision;
      const where = {
        workspaceId,
        deletedAt: null,
        ...(q
          ? {
              title: {
                contains: q.replace(/[\\%_]/g, '\\$&'),
                mode: 'insensitive' as const,
              },
            }
          : {}),
        ...(status === 'confirmed'
          ? { confirmedRevision: { equals: revision } }
          : {}),
        ...(status === 'draft'
          ? {
              OR: [
                { confirmedRevision: null },
                { NOT: { confirmedRevision: { equals: revision } } },
              ],
            }
          : {}),
      };
      const read = async (tx: Connection) => {
        const total = await tx.work.count({ where });
        const current = Math.min(
          page,
          Math.max(1, Math.ceil(total / pageSize)),
        );
        const rows = await tx.work.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (current - 1) * pageSize,
          take: pageSize,
        });
        return {
          items: rows.map(summary),
          page: current,
          pageSize,
          total,
        };
      };
      return db.$transaction
        ? db.$transaction(read, { isolationLevel: 'RepeatableRead' })
        : read(db);
    },
    async get(workspaceId, id) {
      const row = await db.work.findFirst({
        where: { workspaceId, id, deletedAt: null },
      });
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
    async workForDocument(workspaceId, documentId) {
      const row = await db.workDocument.findFirst({
        where: { workspaceId, documentId },
        select: { workId: true },
      });
      return row?.workId ?? null;
    },
    async hasActiveDocument(workspaceId, workId, documentId) {
      const row = await db.workDocument.findFirst({
        where: {
          workspaceId,
          workId,
          documentId,
          work: { deletedAt: null },
          document: { deletedAt: null },
        },
        select: { documentId: true },
      });
      return row !== null;
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
            deletedAt: null,
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
