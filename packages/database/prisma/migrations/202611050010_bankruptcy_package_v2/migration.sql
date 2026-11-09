-- Keep v1 immutable. The selectable v2 removes unsupported claims from a filled source case.
INSERT INTO "DocumentPackageVersion" VALUES ('bfl-bankruptcy-v2','bfl-bankruptcy','Банкротство гражданина');
INSERT INTO "DocumentTemplateVersion" VALUES ('bfl-statement-v2','statement','Заявление о признании гражданина банкротом','c37cc6d264c16c0d2be8d3f146ec79e57ba0ea9184c3b8ccf688ad699ad0ebaa');
INSERT INTO "PackageDocument" VALUES ('bfl-bankruptcy-v2','bfl-statement-v2',0), ('bfl-bankruptcy-v2','bfl-inventory-v1',1), ('bfl-bankruptcy-v2','bfl-creditors-v1',2);
