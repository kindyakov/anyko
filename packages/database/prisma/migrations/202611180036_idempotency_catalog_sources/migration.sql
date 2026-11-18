BEGIN;

ALTER TABLE "IdempotencyKey"
    ADD COLUMN "resourceDocumentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "IdempotencyKey" AS reply
SET "resourceDocumentIds" = ARRAY(
    SELECT item->>'id'
    FROM jsonb_array_elements(COALESCE(reply.body::jsonb->'documents', '[]'::jsonb)) AS item
    WHERE item->>'id' IS NOT NULL
)
WHERE reply.state = 'completed' AND reply."resourceKind" = 'work';

CREATE INDEX "IdempotencyKey_resource_documents_idx"
    ON "IdempotencyKey" USING GIN ("resourceDocumentIds");

COMMIT;
