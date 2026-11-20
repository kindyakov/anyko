BEGIN;

INSERT INTO "DocumentPackageVersion"
SELECT 'bfl-bankruptcy-v8', "packageId", "title"
FROM "DocumentPackageVersion" WHERE "version" = 'bfl-bankruptcy-v7';

INSERT INTO "DocumentTemplateVersion"
SELECT 'bfl-statement-v8', "templateId", "title", '4ad1461e762b08c5d25ad5bfc9ab9baa35957d75cf0432a0e4fe66ab63db5ebf'
FROM "DocumentTemplateVersion" WHERE "version" = 'bfl-statement-v7';

INSERT INTO "PackageDocument" VALUES
  ('bfl-bankruptcy-v8', 'bfl-statement-v8', 0),
  ('bfl-bankruptcy-v8', 'bfl-inventory-v1', 1),
  ('bfl-bankruptcy-v8', 'bfl-creditors-v2', 2);

INSERT INTO "DocumentTemplatePlaceholder" ("templateVersion", "tag", "field", "placeholder")
SELECT 'bfl-statement-v8', "tag", "field", "placeholder"
FROM "DocumentTemplatePlaceholder" WHERE "templateVersion" = 'bfl-statement-v7'
  AND "tag" NOT IN ('debtAsOfDate', 'requestsDetails');

INSERT INTO "DocumentTemplatePlaceholder" ("templateVersion", "tag", "field", "placeholder") VALUES
  ('bfl-statement-v8', 'requestDebtorName', 'requestDebtorName', 'identity'),
  ('bfl-statement-v8', 'requestRegistration', 'requestRegistration', 'identity'),
  ('bfl-statement-v8', 'requestInsolvency', 'requestInsolvency', 'identity');

INSERT INTO "DocumentTemplateRequirement" ("templateVersion", "key", "documentKind", "label", "applicability", "position")
SELECT 'bfl-statement-v8', "key", "documentKind", "label", "applicability", "position"
FROM "DocumentTemplateRequirement" WHERE "templateVersion" = 'bfl-statement-v7';

COMMIT;
