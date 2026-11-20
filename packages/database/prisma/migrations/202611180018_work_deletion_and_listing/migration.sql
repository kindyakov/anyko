BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "Work" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "Work_workspaceId_deletedAt_createdAt_id_idx"
  ON "Work" ("workspaceId", "deletedAt", "createdAt", "id");

CREATE TABLE "WorkDeletion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "AnykoWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "documentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "preparedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3)
);
CREATE INDEX "WorkDeletion_completedAt_failedAt_createdAt_idx"
  ON "WorkDeletion" ("completedAt", "failedAt", "createdAt");
CREATE INDEX "WorkDeletion_workspaceId_completedAt_idx"
  ON "WorkDeletion" ("workspaceId", "completedAt");

COMMIT;
