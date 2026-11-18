import { z } from 'zod';

import type { Database } from '@anyko/database';

import type { DocumentStore, DocumentView } from '../application/ports';
const statusSchema = z.enum(['queued', 'running', 'succeeded', 'failed']);
type RunSummary = {
  status: string;
  errorCode: string | null;
  revision: number | null;
  processorVersion: string | null;
};
type SourceSummary = {
  id: string;
  filename: string;
  sourceKey: string;
  createdAt: Date;
};

/** Explicit document screen read model: source metadata + latest processing summary. */
export function createDocumentReadModel(
  db: Pick<
    Database,
    | 'sourceDocument'
    | 'documentDeletion'
    | 'processingIo'
    | 'documentArtifact'
    | '$queryRaw'
  >,
) {
  const select = {
    id: true,
    filename: true,
    sourceKey: true,
    createdAt: true,
    runs: {
      orderBy: { revision: 'desc' as const },
      take: 1,
      select: {
        status: true,
        errorCode: true,
        revision: true,
        resultKey: true,
        processorVersion: true,
      },
    },
  };
  function legacyPdf(row: {
    sourceKey: string;
    runs: { status: string; processorVersion: string | null }[];
  }) {
    const run = row.runs[0];
    return (
      row.sourceKey.endsWith('.pdf') &&
      run?.status === 'succeeded' &&
      run.processorVersion?.startsWith('mineru-') &&
      !run.processorVersion.includes('+eslav.')
    );
  }

  function view(row: {
    id: string;
    filename: string;
    sourceKey: string;
    createdAt: Date;
    runs: {
      status: string;
      errorCode: string | null;
      revision: number | null;
      processorVersion: string | null;
    }[];
  }): DocumentView {
    const run = legacyPdf(row) ? undefined : row.runs[0];
    const errorCode = run ? run.errorCode : 'OCR_RETRY_REQUIRED';
    return {
      id: row.id,
      filename: row.filename,
      createdAt: row.createdAt.toISOString(),
      status: run ? statusSchema.parse(run.status) : 'failed',
      errorCode,
      ...(typeof run?.revision === 'number' && {
        processingRevision: run.revision,
      }),
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
      const uncertain = await db.processingIo.findMany({
        where: { kind: 'document', workspaceId, uncertain: true },
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
        (await db.processingIo.count({
          where: {
            workspaceId,
            kind: 'document',
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
      if (
        !row ||
        legacyPdf(row) ||
        !run ||
        run.status !== 'succeeded' ||
        !run.resultKey
      )
        return null;
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
    async list(
      workspaceId: string,
      { limit, after, q, formats }: Parameters<DocumentStore['list']>[1],
    ) {
      const namePattern = q ? `%${q.replace(/[\\%_]/g, '\\$&')}%` : null;
      // Формат в ключе хранения нормализован после проверки байтов при загрузке.
      const requestedFormats = formats?.length ? formats.join(',') : null;
      const rows = await db.$queryRaw<
        (SourceSummary &
          Omit<RunSummary, 'status'> & { status: string | null })[]
      >`
        SELECT d.*, r.status, r."errorCode", r.revision, r."processorVersion"
        FROM (
          SELECT id, filename, "sourceKey", "createdAt"
          FROM "SourceDocument"
          WHERE "workspaceId" = ${workspaceId} AND "deletedAt" IS NULL
            AND (${namePattern}::text IS NULL OR
              casefold(filename COLLATE pg_catalog.pg_unicode_fast)
                LIKE casefold(${namePattern}::text COLLATE pg_catalog.pg_unicode_fast))
            AND (${requestedFormats}::text IS NULL OR
              split_part("sourceKey", '.', -1) = ANY(string_to_array(${requestedFormats}::text, ',')))
            AND (${after?.id ?? null}::text IS NULL OR
              ("createdAt", id) < (${after?.createdAt ?? null}::timestamp, ${after?.id ?? null}::text))
          ORDER BY "createdAt" DESC, id DESC
          LIMIT ${limit}
        ) d
        LEFT JOIN LATERAL (
          SELECT status, "errorCode", revision, "processorVersion"
          FROM "Run"
          WHERE "workspaceId" = ${workspaceId} AND "documentId" = d.id
          ORDER BY revision DESC
          LIMIT 1
        ) r ON TRUE
        ORDER BY d."createdAt" DESC, d.id DESC
      `;
      return rows.map((row) =>
        view({
          ...row,
          runs: row.status === null ? [] : [{ ...row, status: row.status }],
        }),
      );
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
      return row && !legacyPdf(row) && run?.status === 'succeeded'
        ? run.resultKey
        : null;
    },
  };
}
