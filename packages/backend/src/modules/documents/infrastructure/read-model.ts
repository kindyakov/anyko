import type { Database } from '@anyko/database';
import { z } from 'zod';
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
    async list(workspaceId: string) {
      return (
        await db.sourceDocument.findMany({
          where: { workspaceId },
          orderBy: { createdAt: 'desc' },
          take: 100,
          select,
        })
      ).map(view);
    },
    async get(workspaceId: string, documentId: string) {
      const row = await db.sourceDocument.findUnique({
        where: { workspaceId_id: { workspaceId, id: documentId } },
        select,
      });
      return row ? view(row) : null;
    },
    async resultKey(workspaceId: string, documentId: string) {
      const row = await db.sourceDocument.findUnique({
        where: { workspaceId_id: { workspaceId, id: documentId } },
        select,
      });
      const run = row?.runs[0];
      return run?.status === 'succeeded' ? run.resultKey : null;
    },
  };
}
