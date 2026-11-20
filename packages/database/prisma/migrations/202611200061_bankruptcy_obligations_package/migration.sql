BEGIN;

INSERT INTO "DocumentPackageVersion"
SELECT 'bfl-bankruptcy-v7', "packageId", "title"
FROM "DocumentPackageVersion" WHERE "version" = 'bfl-bankruptcy-v6';

INSERT INTO "DocumentTemplateVersion" VALUES
  ('bfl-statement-v7', 'statement', 'Заявление о признании гражданина банкротом',
    'd2e4a87174b958508176fc1a5f716732025d8a262319f569233dbf5e9dbfd514'),
  ('bfl-creditors-v2', 'creditors', 'Список кредиторов и должников гражданина',
    'e23d8a2cfd07b3fb00c17fcffd89f34d4f4c9d9d217cd0b4c4ffa8af835774be');

INSERT INTO "PackageDocument" VALUES
  ('bfl-bankruptcy-v7', 'bfl-statement-v7', 0),
  ('bfl-bankruptcy-v7', 'bfl-inventory-v1', 1),
  ('bfl-bankruptcy-v7', 'bfl-creditors-v2', 2);

INSERT INTO "DocumentTemplatePlaceholder" ("templateVersion", "tag", "field", "placeholder")
SELECT 'bfl-statement-v7', "tag", "field", "placeholder"
FROM "DocumentTemplatePlaceholder" WHERE "templateVersion" = 'bfl-statement-v6'
  AND "tag" NOT IN (
    'businessDebts.address', 'businessDebts.arrears', 'businessDebts.inn', 'businessDebts.ogrn',
    'businessDebts.penalties', 'debts.address', 'debts.arrears', 'debts.inn',
    'debts.ogrn', 'debts.penalties'
  );

INSERT INTO "DocumentTemplatePlaceholder" ("templateVersion", "tag", "field", "placeholder")
SELECT 'bfl-creditors-v2', "tag", "field", "placeholder"
FROM "DocumentTemplatePlaceholder" WHERE "templateVersion" = 'bfl-creditors-v1'
  AND "tag" NOT IN ('debts.penalties', 'businessDebts.penalties');

INSERT INTO "DocumentTemplatePlaceholder" ("templateVersion", "tag", "field", "placeholder")
SELECT 'bfl-statement-v7', tag, tag, 'identity'
FROM unnest(ARRAY[
  'creditorHeaders', 'creditorHeaders.name', 'creditorHeaders.inn',
  'creditorHeaders.ogrn', 'creditorHeaders.address'
]) AS tags(tag);

INSERT INTO "DocumentTemplatePlaceholder" ("templateVersion", "tag", "field", "placeholder")
VALUES ('bfl-creditors-v2', 'debtTotal', 'debtTotal', 'RUB_DECIMAL');

COMMIT;
