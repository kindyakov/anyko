-- Remove the remaining unsupported assertion of documentary evidence without rewriting v1/v2.
INSERT INTO "DocumentPackageVersion" VALUES ('bfl-bankruptcy-v3','bfl-bankruptcy','Банкротство гражданина');
INSERT INTO "DocumentTemplateVersion" VALUES ('bfl-statement-v3','statement','Заявление о признании гражданина банкротом','f0b3536aa3130964388b2f6e98767b22879897f98a8d4bab2471ea59cfbce9be');
INSERT INTO "PackageDocument" VALUES ('bfl-bankruptcy-v3','bfl-statement-v3',0), ('bfl-bankruptcy-v3','bfl-inventory-v1',1), ('bfl-bankruptcy-v3','bfl-creditors-v1',2);
