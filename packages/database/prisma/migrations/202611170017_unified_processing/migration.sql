BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10min';

-- Hold off writes from an accidentally live old process during the transfer.
LOCK TABLE "ProcessingRun", "ProcessingOutbox", "ProcessorAttempt", "DocumentIo",
  "WorkRun", "WorkStep", "WorkOutbox", "WorkIo" IN ACCESS EXCLUSIVE MODE;

CREATE TABLE "Run" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "documentId" TEXT,
    "revision" INTEGER,
    "resultKey" TEXT,
    "processorVersion" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "workId" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "inputRevision" INTEGER,
    "settingsRevision" INTEGER,
    "generationId" TEXT,
    "documentIds" JSONB,
    "modelSnapshot" JSONB,
    "initiatedBy" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "attemptToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RunStep" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "documentId" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "usage" JSONB,
    "output" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RunStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RunAttempt" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "documentId" TEXT,
    "runId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RunOutbox" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunOutbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProcessingIo" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "documentId" TEXT,
    "workId" TEXT,
    "requestKey" TEXT,
    "uncertain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessingIo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Run_resultKey_key" ON "Run"("resultKey");

CREATE INDEX "Run_workspaceId_documentId_createdAt_idx" ON "Run"("workspaceId", "documentId", "createdAt");

CREATE INDEX "Run_workspaceId_workId_createdAt_idx" ON "Run"("workspaceId", "workId", "createdAt");

CREATE INDEX "Run_status_leaseUntil_idx" ON "Run"("status", "leaseUntil");

CREATE UNIQUE INDEX "Run_workspaceId_id_key" ON "Run"("workspaceId", "id");

CREATE UNIQUE INDEX "Run_workspaceId_documentId_revision_key" ON "Run"("workspaceId", "documentId", "revision");

CREATE INDEX "RunStep_workspaceId_runId_idx" ON "RunStep"("workspaceId", "runId");

CREATE UNIQUE INDEX "RunStep_workspaceId_runId_stage_documentId_key" ON "RunStep"("workspaceId", "runId", "stage", "documentId");

CREATE INDEX "RunAttempt_workspaceId_documentId_idx" ON "RunAttempt"("workspaceId", "documentId");

CREATE INDEX "RunAttempt_workspaceId_runId_idx" ON "RunAttempt"("workspaceId", "runId");

CREATE UNIQUE INDEX "RunOutbox_runId_key" ON "RunOutbox"("runId");

CREATE INDEX "RunOutbox_deliveredAt_leaseUntil_idx" ON "RunOutbox"("deliveredAt", "leaseUntil");

CREATE UNIQUE INDEX "RunOutbox_workspaceId_runId_key" ON "RunOutbox"("workspaceId", "runId");

CREATE INDEX "ProcessingIo_workspaceId_documentId_idx" ON "ProcessingIo"("workspaceId", "documentId");

CREATE INDEX "ProcessingIo_workspaceId_requestKey_idx" ON "ProcessingIo"("workspaceId", "requestKey");

CREATE INDEX "ProcessingIo_workspaceId_workId_idx" ON "ProcessingIo"("workspaceId", "workId");

ALTER TABLE "Run" ADD CONSTRAINT "Run_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "AnykoWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Run" ADD CONSTRAINT "Run_workspaceId_documentId_fkey" FOREIGN KEY ("workspaceId", "documentId") REFERENCES "SourceDocument"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Run" ADD CONSTRAINT "Run_workspaceId_workId_fkey" FOREIGN KEY ("workspaceId", "workId") REFERENCES "Work"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RunStep" ADD CONSTRAINT "RunStep_workspaceId_runId_fkey" FOREIGN KEY ("workspaceId", "runId") REFERENCES "Run"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RunAttempt" ADD CONSTRAINT "RunAttempt_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "AnykoWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RunAttempt" ADD CONSTRAINT "RunAttempt_workspaceId_runId_fkey" FOREIGN KEY ("workspaceId", "runId") REFERENCES "Run"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RunOutbox" ADD CONSTRAINT "RunOutbox_workspaceId_runId_fkey" FOREIGN KEY ("workspaceId", "runId") REFERENCES "Run"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcessingIo" ADD CONSTRAINT "ProcessingIo_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "AnykoWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProcessingIo" ADD CONSTRAINT "ProcessingIo_workspaceId_workId_fkey" FOREIGN KEY ("workspaceId", "workId") REFERENCES "Work"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Run" ADD CONSTRAINT "run_lease" CHECK (
  (status = 'running' AND "attemptToken" IS NOT NULL AND "leaseUntil" IS NOT NULL)
  OR (status <> 'running' AND "attemptToken" IS NULL AND "leaseUntil" IS NULL)
);
ALTER TABLE "Run" ADD CONSTRAINT "run_kind_state" CHECK (
  attempts >= 0 AND (
    (kind = 'document.ocr' AND status IN ('queued', 'running', 'succeeded', 'failed')
      AND attempts <= 3 AND "documentId" IS NOT NULL AND revision IS NOT NULL AND revision > 0
      AND (status <> 'succeeded' OR ("resultKey" IS NOT NULL AND "processorVersion" IS NOT NULL))
      AND "workId" IS NULL AND "inputRevision" IS NULL AND "generationId" IS NULL
      AND "documentIds" IS NULL AND "modelSnapshot" IS NULL AND "settingsRevision" IS NULL)
    OR
    (kind IN ('work.analysis', 'work.generation')
      AND status IN ('queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled')
      AND "documentId" IS NULL AND revision IS NULL AND "resultKey" IS NULL AND "processorVersion" IS NULL
      AND "workId" IS NOT NULL AND "inputRevision" IS NOT NULL
      AND "documentIds" IS NOT NULL AND "modelSnapshot" IS NOT NULL
      AND (kind = 'work.generation') = ("generationId" IS NOT NULL))
  )
);
CREATE UNIQUE INDEX "run_one_active_work" ON "Run" ("workspaceId", "workId")
  WHERE "workId" IS NOT NULL AND status IN ('queued', 'running');
ALTER TABLE "RunStep" ADD CONSTRAINT "run_step_state" CHECK (
  stage IN ('parsing', 'vision', 'extraction', 'reconciliation', 'generation')
  AND status IN ('queued', 'running', 'succeeded', 'failed', 'skipped')
);
ALTER TABLE "RunAttempt" ADD CONSTRAINT "run_attempt_identity" CHECK ("runId" IS NOT NULL OR "documentId" IS NOT NULL);
ALTER TABLE "ProcessingIo" ADD CONSTRAINT "processing_io_subject" CHECK (
  (kind = 'document' AND "documentId" IS NOT NULL AND "workId" IS NULL)
  OR (kind = 'work' AND "workId" IS NOT NULL AND "documentId" IS NULL AND "requestKey" IS NULL)
);

-- The cutover starts run, attempt and write-barrier history empty. Source documents,
-- works, facts, output files and agent session history remain in their owner tables.
DROP TABLE "ProcessingOutbox", "WorkOutbox", "WorkStep", "ProcessorAttempt", "DocumentIo", "WorkIo", "ProcessingRun", "WorkRun";
COMMIT;
