CREATE TABLE "DocumentTemplatePlaceholder" (
  "templateVersion" TEXT NOT NULL REFERENCES "DocumentTemplateVersion"("version") ON DELETE CASCADE,
  "tag" TEXT NOT NULL,
  "field" TEXT NOT NULL,
  "placeholder" TEXT NOT NULL,
  PRIMARY KEY ("templateVersion", "tag")
);

-- Keep earlier works and generated outputs pinned to their original versions.
INSERT INTO "DocumentPackageVersion" VALUES ('bfl-bankruptcy-v5','bfl-bankruptcy','Банкротство гражданина');
INSERT INTO "DocumentTemplateVersion" VALUES ('bfl-statement-v5','statement','Заявление о признании гражданина банкротом','0f9d75ebe1045b684233da2169174a19af5ec43fbab218bd16703ede0473f9cc');
INSERT INTO "PackageDocument" VALUES ('bfl-bankruptcy-v5','bfl-statement-v5',0), ('bfl-bankruptcy-v5','bfl-inventory-v1',1), ('bfl-bankruptcy-v5','bfl-creditors-v1',2);

INSERT INTO "DocumentTemplatePlaceholder" ("templateVersion", "tag", "field", "placeholder") VALUES
  ('bfl-statement-v5', 'passportIssuedAt', 'passportIssuedAt', 'DD.MM.YYYY'),
  ('bfl-statement-v5', 'passportIssuedAtText', 'passportIssuedAt', 'D MMMM YYYY года'),
  ('bfl-statement-v5', 'birthDate', 'birthDate', 'DD.MM.YYYY'),
  ('bfl-statement-v5', 'debtAsOfDate', 'debtAsOfDate', 'DD.MM.YYYY'),
  ('bfl-statement-v5', 'documentDate', 'documentDate', 'DD.MM.YYYY');
