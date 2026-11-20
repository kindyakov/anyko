import type { Database } from '@anyko/database';

import { WorkError, workSummarySchema } from '..';
import type { WorkStore } from '..';
import { transactionHandle, type Tx } from '../../../platform/transactions';

import { createChecklistStore } from './checklist-store';
import { createWorkDeletionStore } from './deletion-store';
import { createUploadGroupsStore } from './upload-groups';

type Connection = Pick<
  Database,
  | 'work'
  | 'workDocument'
  | 'workEvent'
  | 'workDeletion'
  | 'workUploadGroup'
  | 'workChecklistLink'
  | '$queryRaw'
>;
// Хранилище внутри транзакции действия: токен превращается в клиент транзакции драйвера.
export function worksStoreFor(tx: Tx): WorkStore {
  return createWorkStore(transactionHandle<Connection>(tx));
}
export function createWorkStore(
  db: Connection & Partial<Pick<Database, '$transaction'>>,
): WorkStore {
  const uploads = createUploadGroupsStore(db);
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
    ...uploads,
    ...createChecklistStore(db),
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
    async attach(workspaceId, workId, documents, actorId) {
      if (!documents.length) return 0;
      const uploadGroupId = await uploads.joinUploadGroup(
        workspaceId,
        workId,
        actorId,
      );
      const { count } = await db.workDocument.createMany({
        data: documents.map(({ id, revision, uploaded = false }) => ({
          workspaceId,
          workId,
          documentId: id,
          ocrRevision: revision,
          uploaded,
          uploadGroupId,
        })),
        skipDuplicates: true,
      });
      return count;
    },
    async documents(workspaceId, workId) {
      return (
        await db.workDocument.findMany({
          where: { workspaceId, workId },
          select: {
            document: {
              select: {
                id: true,
                filename: true,
                deletedAt: true,
                requestKey: true,
              },
            },
            ocrRevision: true,
            removed: true,
            uploaded: true,
          },
          orderBy: { documentId: 'asc' },
        })
      ).map(({ document, ocrRevision, removed, uploaded }) => ({
        id: document.id,
        filename: document.filename,
        deleted: removed || document.deletedAt !== null,
        ocrRevision,
        uploaded,
        requestKey: document.requestKey,
      }));
    },
    async worksForDocument(workspaceId, documentId) {
      // Serialize recognition updates with changes to the same work's upload groups.
      const rows = await db.$queryRaw<{ workId: string }[]>`
        SELECT work.id AS "workId"
        FROM "WorkDocument" link
        JOIN "Work" work ON work."workspaceId" = link."workspaceId" AND work.id = link."workId"
        WHERE link."workspaceId" = ${workspaceId} AND link."documentId" = ${documentId}
          AND NOT link.removed AND work."deletedAt" IS NULL
        ORDER BY work.id FOR NO KEY UPDATE OF work
      `;
      return rows.map(({ workId }) => workId);
    },
    async pinPending(workspaceId, documentId, revision) {
      const pending = {
        workspaceId,
        documentId,
        removed: false,
        ocrRevision: null,
        work: { deletedAt: null },
      };
      const recovered = await db.workDocument.findMany({
        where: {
          ...pending,
          uploadGroup: { is: { dispatchedAt: { not: null } } },
        },
        select: { workId: true, uploadGroup: { select: { actorId: true } } },
      });
      for (const { workId, uploadGroup } of recovered) {
        if (!uploadGroup) continue;
        const uploadGroupId = await uploads.joinUploadGroup(
          workspaceId,
          workId,
          uploadGroup.actorId,
        );
        await db.workDocument.updateMany({
          where: { ...pending, workId },
          data: { uploadGroupId, ocrRevision: revision },
        });
      }
      await db.workDocument.updateMany({
        where: pending,
        data: { ocrRevision: revision },
      });
    },
    async removeSource(workspaceId, workId, documentId) {
      const result = await db.workDocument.updateMany({
        where: { workspaceId, workId, documentId, removed: false },
        data: { removed: true },
      });
      return result.count === 1;
    },
    async updateRecognition(workspaceId, workId, documentId, revision) {
      const result = await db.workDocument.updateMany({
        where: {
          workspaceId,
          workId,
          documentId,
          removed: false,
          ocrRevision: { lt: revision },
        },
        data: { ocrRevision: revision },
      });
      return result.count === 1;
    },
    async activeDocument(workspaceId, workId, documentId) {
      const row = await db.workDocument.findFirst({
        where: {
          workspaceId,
          workId,
          documentId,
          removed: false,
          work: { deletedAt: null },
          document: { deletedAt: null },
        },
        select: { ocrRevision: true, uploaded: true },
      });
      return row;
    },
    async touch(workspaceId, id, input) {
      const { expectedRevision } = input;
      const updated = await db.work.updateMany({
        where: {
          workspaceId,
          id,
          ...(expectedRevision === undefined
            ? {}
            : { revision: expectedRevision, deletedAt: null }),
        },
        data: {
          revision: { increment: 1 },
          ...(input.inputChanged ? { inputRevision: { increment: 1 } } : {}),
          confirmedRevision: input.confirmed
            ? input.expectedRevision + 1
            : null,
        },
      });
      if (updated.count !== 1)
        throw new WorkError(
          expectedRevision === undefined ? 'NOT_FOUND' : 'REVISION_CONFLICT',
        );
    },
    async lockRevision(workspaceId, id, revision) {
      const work = await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Work"
        WHERE "workspaceId" = ${workspaceId} AND id = ${id}
          AND revision = ${revision} AND "deletedAt" IS NULL
        FOR UPDATE`;
      if (work.length !== 1) throw new WorkError('REVISION_CONFLICT');
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
            documents: {
              some: {
                OR: [
                  { removed: true },
                  { document: { deletedAt: { not: null } } },
                ],
              },
            },
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
        where: {
          workspaceId,
          workId,
          OR: [{ removed: true }, { document: { deletedAt: { not: null } } }],
        },
      });
    },
  };
}
