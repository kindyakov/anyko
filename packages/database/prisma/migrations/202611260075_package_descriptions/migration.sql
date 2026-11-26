ALTER TABLE "DocumentPackageVersion"
  ADD COLUMN "descriptionHash" TEXT,
  ADD COLUMN "description" TEXT,
  ADD CONSTRAINT "DocumentPackageVersion_description_pair"
    CHECK (("descriptionHash" IS NULL) = ("description" IS NULL));

ALTER TABLE "DocumentTemplateVersion" ADD COLUMN "descriptionHash" TEXT;
