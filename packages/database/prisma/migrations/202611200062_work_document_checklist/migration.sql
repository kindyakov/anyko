BEGIN;

CREATE TYPE "TemplateRequirementApplicability" AS ENUM ('usual', 'conditional');
CREATE TYPE "WorkChecklistDecision" AS ENUM ('found', 'review', 'confirmed', 'rejected');

CREATE TABLE "DocumentTemplateRequirement" (
  "templateVersion" TEXT NOT NULL REFERENCES "DocumentTemplateVersion"("version") ON DELETE CASCADE ON UPDATE CASCADE,
  "key" TEXT NOT NULL,
  "documentKind" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "applicability" "TemplateRequirementApplicability" NOT NULL,
  "position" INTEGER NOT NULL,
  PRIMARY KEY ("templateVersion", "key"),
  UNIQUE ("templateVersion", "position")
);

CREATE UNIQUE INDEX "WorkDocument_workspaceId_workId_documentId_key"
  ON "WorkDocument"("workspaceId", "workId", "documentId");

CREATE TABLE "WorkChecklistLink" (
  "workspaceId" TEXT NOT NULL,
  "workId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "requirementKey" TEXT NOT NULL,
  "ocrRevision" INTEGER,
  "decision" "WorkChecklistDecision" NOT NULL,
  "quote" TEXT,
  "page" INTEGER,
  PRIMARY KEY ("workspaceId", "workId", "documentId", "requirementKey"),
  FOREIGN KEY ("workspaceId", "workId", "documentId")
    REFERENCES "WorkDocument"("workspaceId", "workId", "documentId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Requirements belong only to the newly published template versions.
WITH requirements ("key", "documentKind", "label", "applicability", "position", "templateVersions") AS (
  VALUES
    ('passport', 'identity', 'Паспорт гражданина', 'usual', 1, ARRAY['bfl-statement-v7']),
    ('snils', 'identity', 'СНИЛС', 'usual', 2, ARRAY['bfl-statement-v7']),
    ('insurance-account', 'insurance-statement', 'Выписка о состоянии индивидуального лицевого счёта', 'usual', 3, ARRAY['bfl-statement-v7']),
    ('inn', 'tax-registration', 'Свидетельство о постановке на налоговый учёт (ИНН)', 'conditional', 4, ARRAY['bfl-statement-v7']),
    ('debt-certificate', 'debt-certificate', 'Справки о задолженности', 'usual', 5, ARRAY['bfl-statement-v7', 'bfl-creditors-v2']),
    ('loan-agreement', 'agreement', 'Кредитные договоры и договоры займа', 'conditional', 6, ARRAY['bfl-statement-v7', 'bfl-creditors-v2']),
    ('bank-statement', 'bank-statement', 'Выписки по банковским счетам', 'conditional', 7, ARRAY['bfl-statement-v7']),
    ('employment', 'employment-history', 'Сведения о трудовой деятельности', 'conditional', 8, ARRAY['bfl-statement-v7']),
    ('income', 'income-certificate', 'Справки о доходах', 'conditional', 9, ARRAY['bfl-statement-v7']),
    ('marriage', 'civil-status', 'Свидетельство о заключении или расторжении брака', 'conditional', 10, ARRAY['bfl-statement-v7']),
    ('children', 'birth-certificate', 'Свидетельства о рождении детей', 'conditional', 11, ARRAY['bfl-statement-v7']),
    ('property', 'property-register', 'Выписки ЕГРН и документы об имуществе', 'conditional', 12, ARRAY['bfl-statement-v7']),
    ('procedure-expenses', 'payment-receipt', 'Подтверждение оплаты расходов процедуры', 'conditional', 13, ARRAY['bfl-statement-v7'])
)
INSERT INTO "DocumentTemplateRequirement" ("templateVersion", "key", "documentKind", "label", "applicability", "position")
SELECT template."version", req."key", req."documentKind", req."label",
       req."applicability"::"TemplateRequirementApplicability", req."position"
FROM requirements req
JOIN "DocumentTemplateVersion" template ON template."version" = ANY(req."templateVersions");

COMMIT;
