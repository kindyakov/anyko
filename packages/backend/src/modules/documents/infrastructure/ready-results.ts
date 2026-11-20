import type { Database } from '@anyko/database';

import { transactionHandle, type Tx } from '../../../platform/transactions';

export function createReadyResults(db: Pick<Database, '$queryRaw'>) {
  return async (
    workspaceId: string,
    documentId: string,
    revision?: number | null,
  ) => {
    if (revision === null) return null;
    const [ready] = await db.$queryRaw<
      { resultKey: string; revision: number }[]
    >`
      SELECT "resultKey", revision FROM "ReadyDocumentRun"
      WHERE "workspaceId" = ${workspaceId} AND "documentId" = ${documentId}
        AND (${revision ?? null}::integer IS NULL OR revision = ${revision ?? null}::integer)
      ORDER BY revision DESC LIMIT 1
    `;
    return ready ?? null;
  };
}

// The same source lock serializes attachment, OCR completion and catalog deletion.
export async function lockDocumentRevisions(
  tx: Tx,
  workspaceId: string,
  documentIds: string[],
  firstReady = false,
) {
  const db = transactionHandle<Pick<Database, '$queryRaw'>>(tx);
  const locked = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "SourceDocument"
    WHERE "workspaceId" = ${workspaceId} AND id = ANY(${documentIds}::text[])
      AND "deletedAt" IS NULL
    ORDER BY id FOR UPDATE
  `;
  if (!locked.length) return [];
  return db.$queryRaw<{ id: string; revision: number | null }[]>`
    SELECT d.id, CASE WHEN ${firstReady} THEN min(r.revision) ELSE max(r.revision) END AS revision
    FROM unnest(${locked.map(({ id }) => id)}::text[]) AS d(id)
    LEFT JOIN "ReadyDocumentRun" r ON r."workspaceId" = ${workspaceId} AND r."documentId" = d.id
    GROUP BY d.id
  `;
}
