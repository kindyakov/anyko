INSERT INTO "DocumentPackageVersion"
SELECT 'bfl-bankruptcy-v6', "packageId", "title"
FROM "DocumentPackageVersion" WHERE "version" = 'bfl-bankruptcy-v5';

INSERT INTO "DocumentTemplateVersion"
SELECT 'bfl-statement-v6', "templateId", "title", "checksum"
FROM "DocumentTemplateVersion" WHERE "version" = 'bfl-statement-v5';

INSERT INTO "PackageDocument"
SELECT 'bfl-bankruptcy-v6',
  CASE WHEN "templateVersion" = 'bfl-statement-v5' THEN 'bfl-statement-v6' ELSE "templateVersion" END,
  "position"
FROM "PackageDocument" WHERE "packageVersion" = 'bfl-bankruptcy-v5';

INSERT INTO "DocumentTemplatePlaceholder" ("templateVersion", "tag", "field", "placeholder")
SELECT 'bfl-statement-v6', "tag",
  CASE WHEN "tag" = 'debtTotalWords' THEN 'debtTotal' ELSE "field" END,
  CASE "tag"
    WHEN 'debtTotal' THEN 'RUB_DECIMAL'
    WHEN 'debtTotalWords' THEN 'RUB_WORDS'
    ELSE "placeholder"
  END
FROM "DocumentTemplatePlaceholder" WHERE "templateVersion" = 'bfl-statement-v5';
