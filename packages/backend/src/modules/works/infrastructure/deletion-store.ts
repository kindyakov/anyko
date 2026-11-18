import type { Database } from '@anyko/database';

import type { WorkDeletionStore } from '..';
import { transactionHandle, type Tx } from '../../../platform/transactions';

export async function lockLiveWorkForResponse(
  tx: Tx,
  workspaceId: string,
  workId: string,
) {
  const db = transactionHandle<Pick<Database, '$queryRaw'>>(tx);
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Work"
    WHERE "workspaceId" = ${workspaceId} AND id = ${workId} AND "deletedAt" IS NULL
    FOR SHARE
  `;
  return rows.length === 1;
}

export async function lockLiveWorkUploadForResponse(
  tx: Tx,
  workspaceId: string,
  documentId: string,
) {
  const db = transactionHandle<Pick<Database, '$queryRaw'>>(tx);
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT work.id FROM "WorkDocument" link
    JOIN "Work" work ON work."workspaceId" = link."workspaceId" AND work.id = link."workId"
    WHERE link."workspaceId" = ${workspaceId} AND link."documentId" = ${documentId}
      AND link.uploaded AND NOT link.removed AND work."deletedAt" IS NULL
    FOR SHARE OF work, link
  `;
  return rows.length > 0;
}

export function createWorkDeletionStore(
  db: Pick<Database, 'work' | 'workDeletion'>,
): WorkDeletionStore {
  return {
    deletion: (workspaceId, id) =>
      db.workDeletion.findFirst({ where: { workspaceId, id } }),
    async requestDeletion(workspaceId, id, documentIds, at) {
      await db.work.update({
        where: { workspaceId_id: { workspaceId, id }, deletedAt: null },
        data: { deletedAt: at },
      });
      await db.workDeletion.create({
        data: { id, workspaceId, documentIds, createdAt: at },
      });
    },
    pendingDeletions: (workspaceId) =>
      db.workDeletion.findMany({
        where: {
          completedAt: null,
          ...(workspaceId === undefined ? {} : { workspaceId }),
        },
        orderBy: [
          { failedAt: { sort: 'asc', nulls: 'first' } },
          { createdAt: 'asc' },
          { id: 'asc' },
        ],
        take: 20,
      }),
    async prepareDeletion(workspaceId, id, at) {
      await db.workDeletion.updateMany({
        where: { id, workspaceId, completedAt: null },
        data: { preparedAt: at, failedAt: null },
      });
    },
    async failDeletion(workspaceId, id, at) {
      await db.workDeletion.updateMany({
        where: { id, workspaceId, completedAt: null },
        data: { failedAt: at },
      });
    },
    async finishDeletion(workspaceId, id, at) {
      await db.work.delete({
        where: {
          workspaceId_id: { workspaceId, id },
          deletedAt: { not: null },
        },
      });
      await db.workDeletion.updateMany({
        where: { id, workspaceId },
        data: { completedAt: at, documentIds: [], failedAt: null },
      });
    },
  };
}
