-- Preserve saved technical works while moving their binding to a versioned package.
ALTER TABLE "Work" RENAME COLUMN "templateVersion" TO "packageVersion";
ALTER TABLE "WorkGeneration" RENAME COLUMN "templateVersion" TO "packageVersion";
CREATE TABLE "DocumentPackageVersion" ("version" TEXT PRIMARY KEY, "packageId" TEXT NOT NULL, "title" TEXT NOT NULL);
CREATE TABLE "DocumentTemplateVersion" ("version" TEXT PRIMARY KEY, "templateId" TEXT NOT NULL, "title" TEXT NOT NULL, "checksum" TEXT NOT NULL CHECK ("checksum" ~ '^[a-f0-9]{64}$'));
CREATE TABLE "PackageDocument" (
 "packageVersion" TEXT NOT NULL REFERENCES "DocumentPackageVersion"("version") ON DELETE RESTRICT,
 "templateVersion" TEXT NOT NULL REFERENCES "DocumentTemplateVersion"("version") ON DELETE RESTRICT,
 "position" INTEGER NOT NULL CHECK ("position" >= 0),
 PRIMARY KEY ("packageVersion", "templateVersion"), UNIQUE ("packageVersion", "position")
);
INSERT INTO "DocumentPackageVersion" VALUES ('technical-document-v1','technical-document','Технический пакет'), ('bfl-bankruptcy-v1','bfl-bankruptcy','Банкротство гражданина');
INSERT INTO "DocumentTemplateVersion" VALUES ('technical-document-v1','technical-document','Технический документ','31be38c49ebe46d2f1791d56f53b6ea27df37ea3055f632c4752b96ba47b2cd3');
INSERT INTO "DocumentTemplateVersion" VALUES ('bfl-statement-v1','statement','Заявление о признании гражданина банкротом','04fd3ae5aed53f91cec24c8fa5f9bbac0672369a432d693558093b2d25e86ab1');
INSERT INTO "DocumentTemplateVersion" VALUES ('bfl-inventory-v1','inventory','Опись имущества гражданина','d9937f06af84949dc6a4d3e05c8e9c808311ec9443ab25e1839a589ecbd2a1a3');
INSERT INTO "DocumentTemplateVersion" VALUES ('bfl-creditors-v1','creditors','Список кредиторов и должников гражданина','9f952590df7e250c98e527e3d989016d28eb9b4adce54ae266814630a4ed6430');
INSERT INTO "PackageDocument" VALUES ('technical-document-v1','technical-document-v1',0);
INSERT INTO "PackageDocument" VALUES ('bfl-bankruptcy-v1','bfl-statement-v1',0);
INSERT INTO "PackageDocument" VALUES ('bfl-bankruptcy-v1','bfl-inventory-v1',1);
INSERT INTO "PackageDocument" VALUES ('bfl-bankruptcy-v1','bfl-creditors-v1',2);
ALTER TABLE "Work" ADD CONSTRAINT "Work_packageVersion_fkey" FOREIGN KEY ("packageVersion") REFERENCES "DocumentPackageVersion"("version") ON DELETE RESTRICT;
ALTER TABLE "WorkGeneration" ADD CONSTRAINT "WorkGeneration_packageVersion_fkey" FOREIGN KEY ("packageVersion") REFERENCES "DocumentPackageVersion"("version") ON DELETE RESTRICT;
ALTER TABLE "WorkGeneration" DROP CONSTRAINT "work_generation_state";
ALTER TABLE "WorkGeneration" ADD CONSTRAINT "work_generation_state" CHECK ("revision" >= 0 AND "status" IN ('queued','succeeded','partial','failed'));
CREATE UNIQUE INDEX "WorkGeneration_workspaceId_workId_id_packageVersion_key" ON "WorkGeneration"("workspaceId","workId","id","packageVersion");
CREATE TABLE "WorkGenerationFile" (
 "id" TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL, "workId" TEXT NOT NULL, "generationId" TEXT NOT NULL, "packageVersion" TEXT NOT NULL,
 "templateVersion" TEXT NOT NULL, "title" TEXT NOT NULL, "filename" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'queued', "errorCode" TEXT, "key" TEXT UNIQUE, "checksum" TEXT,
 FOREIGN KEY ("workspaceId","workId","generationId","packageVersion") REFERENCES "WorkGeneration"("workspaceId","workId","id","packageVersion") ON DELETE CASCADE,
 FOREIGN KEY ("packageVersion","templateVersion") REFERENCES "PackageDocument"("packageVersion","templateVersion") ON DELETE RESTRICT,
 UNIQUE ("generationId","templateVersion"),
 CONSTRAINT "work_generation_file_state" CHECK ("status" IN ('queued','succeeded','failed') AND ("status" != 'succeeded' OR ("key" IS NOT NULL AND "checksum" ~ '^[a-f0-9]{64}$')))
);
CREATE INDEX "WorkGenerationFile_workspaceId_workId_generationId_idx" ON "WorkGenerationFile"("workspaceId","workId","generationId");
-- Backfill existing outputs, preserving their original key/checksum and status.
INSERT INTO "WorkGenerationFile" ("id","workspaceId","workId","generationId","packageVersion","templateVersion","title","filename","status","key","checksum")
SELECT "id","workspaceId","workId","id","packageVersion","packageVersion",'Технический документ','technical-document.docx',"status","key","checksum" FROM "WorkGeneration";
ALTER TABLE "WorkGeneration" DROP COLUMN "key", DROP COLUMN "checksum";
