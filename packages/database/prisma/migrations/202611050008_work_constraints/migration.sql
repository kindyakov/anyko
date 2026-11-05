ALTER TABLE "Work" ADD CONSTRAINT "work_revision_nonnegative" CHECK ("revision" >= 0 AND "inputRevision" >= 0 AND ("confirmedRevision" IS NULL OR "confirmedRevision" = "revision"));
ALTER TABLE "WorkRun" ADD CONSTRAINT "work_run_state" CHECK (
  "kind" IN ('analysis', 'generation') AND "status" IN ('queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled')
  AND ("kind" = 'generation') = ("generationId" IS NOT NULL)
  AND ("kind" = 'analysis') = ("settingsRevision" IS NOT NULL)
  AND ("status" = 'running') = ("attemptToken" IS NOT NULL AND "leaseUntil" IS NOT NULL)
);
CREATE UNIQUE INDEX "work_one_active_run" ON "WorkRun" ("workspaceId", "workId") WHERE "status" IN ('queued', 'running');
ALTER TABLE "WorkStep" ADD CONSTRAINT "work_step_state" CHECK (
  "stage" IN ('parsing', 'vision', 'extraction', 'reconciliation', 'generation') AND "status" IN ('queued', 'running', 'succeeded', 'failed', 'skipped')
);
ALTER TABLE "WorkGeneration" ADD CONSTRAINT "work_generation_state" CHECK ("revision" >= 0 AND "status" IN ('queued', 'succeeded', 'failed') AND ("status" != 'succeeded' OR ("key" IS NOT NULL AND "checksum" IS NOT NULL)));
