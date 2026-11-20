-- Keep earlier statement templates and generated work snapshots pinned to their original version.
INSERT INTO "DocumentPackageVersion" VALUES ('bfl-bankruptcy-v4','bfl-bankruptcy','Банкротство гражданина');
INSERT INTO "DocumentTemplateVersion" VALUES ('bfl-statement-v4','statement','Заявление о признании гражданина банкротом','ea44495a864a162b9811893c95cd34abbe401432ec25035ec3b284b26d62fda2');
INSERT INTO "PackageDocument" VALUES ('bfl-bankruptcy-v4','bfl-statement-v4',0), ('bfl-bankruptcy-v4','bfl-inventory-v1',1), ('bfl-bankruptcy-v4','bfl-creditors-v1',2);
