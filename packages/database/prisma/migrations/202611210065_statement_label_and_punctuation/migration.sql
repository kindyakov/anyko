BEGIN;

INSERT INTO "DocumentPackageVersion" ("version", "packageId", "title")
SELECT 'bfl-bankruptcy-v12', "packageId", "title"
FROM "DocumentPackageVersion"
WHERE "version" = 'bfl-bankruptcy-v11';

INSERT INTO "DocumentTemplateVersion" ("version", "templateId", "title", "checksum")
SELECT 'bfl-statement-v11', "templateId", "title",
       '2b36b41bacf185bd230667f18b0beda0baf6b1c12cbccb6b98e3707f099ae756'
FROM "DocumentTemplateVersion"
WHERE "version" = 'bfl-statement-v10';

INSERT INTO "PackageDocument" ("packageVersion", "templateVersion", "position")
SELECT 'bfl-bankruptcy-v12',
       CASE WHEN "templateVersion" = 'bfl-statement-v10' THEN 'bfl-statement-v11' ELSE "templateVersion" END,
       "position"
FROM "PackageDocument"
WHERE "packageVersion" = 'bfl-bankruptcy-v11';

INSERT INTO "DocumentTemplatePlaceholder" ("templateVersion", "tag", "field", "placeholder")
SELECT 'bfl-statement-v11', "tag", "field", "placeholder"
FROM "DocumentTemplatePlaceholder"
WHERE "templateVersion" = 'bfl-statement-v10';

INSERT INTO "DocumentTemplateRequirement" ("templateVersion", "key", "documentKind", "label", "applicability", "position")
SELECT 'bfl-statement-v11', "key", "documentKind", "label", "applicability", "position"
FROM "DocumentTemplateRequirement"
WHERE "templateVersion" = 'bfl-statement-v10';

COMMIT;
