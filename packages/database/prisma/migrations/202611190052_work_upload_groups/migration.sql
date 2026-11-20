CREATE TABLE "WorkUploadGroup" (
    "id" BIGSERIAL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    CONSTRAINT "WorkUploadGroup_workspaceId_workId_fkey"
        FOREIGN KEY ("workspaceId", "workId") REFERENCES "Work"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WorkUploadGroup_workspaceId_workId_id_key" ON "WorkUploadGroup"("workspaceId", "workId", "id");
CREATE INDEX "WorkUploadGroup_dispatchedAt_id_idx" ON "WorkUploadGroup"("dispatchedAt", "id");
ALTER TABLE "WorkDocument" ADD COLUMN "uploadGroupId" BIGINT;
CREATE INDEX "WorkDocument_workspaceId_workId_uploadGroupId_idx" ON "WorkDocument"("workspaceId", "workId", "uploadGroupId");
ALTER TABLE "WorkDocument" ADD CONSTRAINT "WorkDocument_workspaceId_workId_uploadGroupId_fkey"
    FOREIGN KEY ("workspaceId", "workId", "uploadGroupId") REFERENCES "WorkUploadGroup"("workspaceId", "workId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Run" ADD COLUMN "automaticUpload" BOOLEAN NOT NULL DEFAULT false;

-- Preserve existing analyses. Only sources never included in a work analysis
-- enter a group on upgrade.
WITH pending_links AS (
    SELECT link."workspaceId", link."workId", link."documentId", work."createdBy"
    FROM "WorkDocument" link
    JOIN "Work" work ON work."workspaceId" = link."workspaceId" AND work."id" = link."workId"
    JOIN "SourceDocument" source ON source."workspaceId" = link."workspaceId" AND source."id" = link."documentId"
    WHERE NOT link."removed" AND work."deletedAt" IS NULL AND source."deletedAt" IS NULL
        AND NOT EXISTS (
            SELECT 1 FROM "Run" analysis
            WHERE analysis."workspaceId" = link."workspaceId" AND analysis."workId" = link."workId"
                AND analysis."kind" = 'work.analysis' AND analysis."documentIds" ? link."documentId"
        )
), groups AS (
    INSERT INTO "WorkUploadGroup" ("workspaceId", "workId", "actorId")
    SELECT DISTINCT "workspaceId", "workId", "createdBy" FROM pending_links
    RETURNING "id", "workspaceId", "workId"
)
UPDATE "WorkDocument" link SET "uploadGroupId" = groups."id"
FROM groups JOIN pending_links pending ON pending."workspaceId" = groups."workspaceId" AND pending."workId" = groups."workId"
WHERE link."workspaceId" = pending."workspaceId" AND link."workId" = pending."workId" AND link."documentId" = pending."documentId";
