BEGIN;

ALTER TABLE "IdempotencyKey"
    ADD COLUMN "resourceKind" TEXT,
    ADD COLUMN "resourceId" TEXT;

-- Recover references for pre-existing successful replies before changing their encoding.
UPDATE "IdempotencyKey"
SET "resourceKind" = 'work', "resourceId" = "body" #>> '{work,id}'
WHERE "state" = 'completed' AND "command" = 'POST /workspaces/:workspaceId/works'
    AND "body" #>> '{work,id}' IS NOT NULL;

UPDATE "IdempotencyKey"
SET "resourceKind" = 'document', "resourceId" = "body" #>> '{document,id}'
WHERE "state" = 'completed'
    AND "command" IN ('POST /workspaces/:workspaceId/recognitions',
                      'POST /workspaces/:workspaceId/works/:workId/documents')
    AND "body" #>> '{document,id}' IS NOT NULL;

-- The old store kept a synthetic 404 after erasing the deleted resource's reply.
UPDATE "IdempotencyKey"
SET "state" = 'resource_unavailable', "status" = NULL, "body" = NULL
WHERE "state" = 'completed' AND "status" = 404;

ALTER TABLE "IdempotencyKey"
    ALTER COLUMN "body" TYPE TEXT USING "body"::text;

CREATE INDEX "IdempotencyKey_resource_idx"
    ON "IdempotencyKey"("workspaceId", "resourceKind", "resourceId");

COMMIT;
