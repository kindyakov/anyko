import { z } from 'zod';

import type { Database } from '@anyko/database';

import type { DocumentView } from '../application/ports';
const statusSchema = z.enum(['queued', 'running', 'succeeded', 'failed']);
/** Explicit document screen read model: source metadata + latest processing summary. */
export function createDocumentReadModel(db: Database) {
  const select = {
    id: true,
    filename: true,
    createdAt: true,
    runs: {
      orderBy: { revision: 'desc' as const },
      take: 1,
      select: { status: true, errorCode: true, resultKey: true },
    },
  };
  function view(row: {
    id: string;
    filename: string;
    createdAt: Date;
    runs: { status: string; errorCode: string | null }[];
  }): DocumentView {
    const run = row.runs[0];
    if (!run) throw new Error('DOCUMENT_WITHOUT_RUN');
    return {
      id: row.id,
      filename: row.filename,
      createdAt: row.createdAt.toISOString(),
      status: statusSchema.parse(run.status),
      errorCode: run.errorCode,
    };
  }
  return {
    async source(workspaceId: string, documentId: string) {
      const row = await db.sourceDocument.findFirst({
        where: { workspaceId, id: documentId, deletedAt: null },
        select: {
          sourceKey: true,
          sourceChecksum: true,
          size: true,
          filename: true,
        },
      });
      return row
        ? {
            key: row.sourceKey,
            checksum: row.sourceChecksum,
            size: row.size,
            filename: row.filename,
          }
        : null;
    },
    async pendingDeletions(workspaceId: string) {
      const rows = await db.documentDeletion.findMany({
        where: { workspaceId, completedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, requestKey: true, createdAt: true },
      });
      const uncertain = await db.documentIo.findMany({
        where: { workspaceId, uncertain: true },
        select: { documentId: true, requestKey: true },
      });
      return rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        status: uncertain.some(
          (writer) =>
            writer.documentId === row.id ||
            writer.requestKey === row.requestKey,
        )
          ? ('needs-recovery' as const)
          : ('deleting' as const),
      }));
    },
    async deletion(workspaceId: string, documentId: string) {
      const row = await db.documentDeletion.findFirst({
        where: { id: documentId, workspaceId },
      });
      if (
        row &&
        !row.completedAt &&
        (await db.documentIo.count({
          where: {
            workspaceId,
            uncertain: true,
            OR: [{ documentId }, { requestKey: row.requestKey }],
          },
        }))
      )
        return 'needs-recovery' as const;
      return row
        ? row.completedAt
          ? ('deleted' as const)
          : ('deleting' as const)
        : null;
    },
    async image(workspaceId: string, documentId: string, index: number) {
      const row = await db.sourceDocument.findFirst({
        where: { id: documentId, workspaceId, deletedAt: null },
        select,
      });
      const run = row?.runs[0];
      if (!run || run.status !== 'succeeded' || !run.resultKey) return null;
      return db.documentArtifact.findFirst({
        where: {
          workspaceId,
          documentId,
          manifestKey: run.resultKey,
          kind: 'image',
          position: index,
        },
        select: { key: true, contentType: true, size: true, checksum: true },
      });
    },
    async list(workspaceId: string) {
      return (
        await db.sourceDocument.findMany({
          where: { workspaceId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 100,
          select,
        })
      ).map(view);
    },
    async get(workspaceId: string, documentId: string) {
      const row = await db.sourceDocument.findUnique({
        where: {
          workspaceId_id: { workspaceId, id: documentId },
          deletedAt: null,
        },
        select,
      });
      return row ? view(row) : null;
    },
    async resultKey(workspaceId: string, documentId: string) {
      const row = await db.sourceDocument.findUnique({
        where: {
          workspaceId_id: { workspaceId, id: documentId },
          deletedAt: null,
        },
        select,
      });
      const run = row?.runs[0];
      return run?.status === 'succeeded' ? run.resultKey : null;
    },
  };
}
