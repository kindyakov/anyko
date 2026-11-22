BEGIN;

INSERT INTO "DocumentPackageVersion" ("version", "packageId", "title")
SELECT 'bfl-bankruptcy-v13', "packageId", "title"
FROM "DocumentPackageVersion"
WHERE "version" = 'bfl-bankruptcy-v12';

INSERT INTO "PackageDocument" ("packageVersion", "templateVersion", "position")
SELECT 'bfl-bankruptcy-v13', "templateVersion", "position"
FROM "PackageDocument"
WHERE "packageVersion" = 'bfl-bankruptcy-v12';

COMMIT;
