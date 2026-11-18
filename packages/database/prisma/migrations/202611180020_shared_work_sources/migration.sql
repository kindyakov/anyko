BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "WorkDocument"
  ADD COLUMN "ocrRevision" INTEGER,
  ADD COLUMN "removed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "uploaded" BOOLEAN NOT NULL DEFAULT true,
  DROP CONSTRAINT "WorkDocument_pkey",
  ADD CONSTRAINT "WorkDocument_pkey" PRIMARY KEY ("workId", "documentId");
DROP INDEX "WorkDocument_workspaceId_documentId_key";
ALTER TABLE "WorkDocument" ALTER COLUMN "uploaded" SET DEFAULT false;
CREATE INDEX "WorkDocument_workspaceId_documentId_idx"
  ON "WorkDocument" ("workspaceId", "documentId");

CREATE VIEW "ReadyDocumentRun" AS
  SELECT run."workspaceId", run."documentId", run.revision, run."resultKey"
  FROM "Run" run
  JOIN "SourceDocument" doc
    ON doc."workspaceId" = run."workspaceId" AND doc.id = run."documentId"
  WHERE doc."deletedAt" IS NULL
    AND run.status = 'succeeded' AND run."resultKey" IS NOT NULL
    AND NOT (doc."sourceKey" LIKE '%.pdf'
      AND COALESCE(run."processorVersion", '') LIKE 'mineru-%'
      AND COALESCE(run."processorVersion", '') NOT LIKE '%+eslav.%');

-- Existing links keep the last usable result, including when a retry is pending.
UPDATE "WorkDocument" link
SET "ocrRevision" = (
  SELECT ready.revision
  FROM "ReadyDocumentRun" ready
  WHERE ready."workspaceId" = link."workspaceId" AND ready."documentId" = link."documentId"
  ORDER BY ready.revision DESC
  LIMIT 1
);

ALTER TABLE "WorkDocument" ADD CONSTRAINT "WorkDocument_workspaceId_documentId_ocrRevision_fkey"
  FOREIGN KEY ("workspaceId", "documentId", "ocrRevision")
  REFERENCES "Run" ("workspaceId", "documentId", revision)
  ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
