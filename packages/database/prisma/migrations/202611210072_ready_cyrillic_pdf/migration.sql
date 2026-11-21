BEGIN;
SET LOCAL lock_timeout = '5s';

-- Snapshot of pdfOcrProcessorVersionPattern, checked against TypeScript in
-- work-sources-migration.test.ts. Historical migrations stay immutable.
CREATE OR REPLACE VIEW "ReadyDocumentRun" AS
  SELECT run."workspaceId", run."documentId", run.revision, run."resultKey"
  FROM "Run" run
  JOIN "SourceDocument" doc
    ON doc."workspaceId" = run."workspaceId" AND doc.id = run."documentId"
  WHERE doc."deletedAt" IS NULL
    AND run.status = 'succeeded' AND run."resultKey" IS NOT NULL
    AND NOT (doc."sourceKey" LIKE '%.pdf'
      AND COALESCE(run."processorVersion", '') LIKE 'mineru-%'
      AND COALESCE(run."processorVersion", '') !~ '[+](eslav|cyrillic-pdf)[.][0-9]+$');

WITH ready_pdfs AS (
  SELECT ready."workspaceId", ready."documentId", max(ready.revision) AS revision
  FROM "ReadyDocumentRun" ready
  JOIN "SourceDocument" doc
    ON doc."workspaceId" = ready."workspaceId" AND doc.id = ready."documentId"
  WHERE doc."sourceKey" LIKE '%.pdf'
  GROUP BY ready."workspaceId", ready."documentId"
)
UPDATE "WorkDocument" link
SET "ocrRevision" = ready.revision
FROM ready_pdfs ready, "Work" work
WHERE ready."workspaceId" = link."workspaceId"
  AND ready."documentId" = link."documentId"
  AND work."workspaceId" = link."workspaceId" AND work.id = link."workId"
  AND work."deletedAt" IS NULL
  AND link."ocrRevision" IS NULL AND NOT link.removed;

COMMIT;
