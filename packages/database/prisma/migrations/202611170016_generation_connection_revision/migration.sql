-- The existing nullable settingsRevision also records the selection for generation.
-- Historical analysis and generation rows retain their original revision values.
ALTER TABLE "WorkRun" DROP CONSTRAINT "work_run_state";
ALTER TABLE "WorkRun" ADD CONSTRAINT "work_run_state" CHECK (
  "kind" IN ('analysis', 'generation')
  AND "status" IN ('queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled')
  AND ("kind" = 'generation') = ("generationId" IS NOT NULL)
  AND ("kind" <> 'analysis' OR "settingsRevision" IS NOT NULL)
  AND ("status" = 'running') = ("attemptToken" IS NOT NULL AND "leaseUntil" IS NOT NULL)
);
