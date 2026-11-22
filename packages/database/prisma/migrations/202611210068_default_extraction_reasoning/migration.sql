BEGIN;

ALTER TABLE "LlmSettings" ALTER COLUMN "extractionEnableReasoning" SET DEFAULT true;
UPDATE "LlmSettings" SET "extractionEnableReasoning" = true WHERE NOT "extractionEnableReasoning";

COMMIT;
