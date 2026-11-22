BEGIN;

ALTER TABLE "LlmSettings"
  ADD COLUMN "visionDisableReasoning" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "extractionEnableReasoning" BOOLEAN NOT NULL DEFAULT false;

-- Preserve the known capability on legacy RouterAI/DeepSeek routes, independently by role.
UPDATE "LlmSettings"
SET
  "visionDisableReasoning" = "visionModel" ~* '(^|/)deepseek-v4([.-]|$)',
  "extractionEnableReasoning" = "extractionModel" ~* '(^|/)deepseek-v4([.-]|$)'
WHERE "baseURL" ~* '^https://routerai[.]ru(:[0-9]+)?(/|$)'
  AND (
    "visionModel" ~* '(^|/)deepseek-v4([.-]|$)'
    OR "extractionModel" ~* '(^|/)deepseek-v4([.-]|$)'
  );

COMMIT;
