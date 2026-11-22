BEGIN;

CREATE TEMP TABLE bfl_layout_versions (
  old_version text PRIMARY KEY,
  new_version text NOT NULL,
  checksum text NOT NULL
) ON COMMIT DROP;

INSERT INTO bfl_layout_versions VALUES
  ('bfl-statement-v11', 'bfl-statement-v12', '0d81abf458a8a5cc85d9d65dc5e9958a35fa3692374712c081bb38d2b73856f7'),
  ('bfl-inventory-v2', 'bfl-inventory-v3', 'c7a8c2631750e71fde2172967762b3d5cddd39dd8d4ee3f0f9a6dc493ecd66e1'),
  ('bfl-creditors-v3', 'bfl-creditors-v4', '58a9a914b05a1e7ccf64be3644aa04d7cfafc355d79a73f6593fcaea89697cda');

INSERT INTO "DocumentPackageVersion" ("version", "packageId", "title")
SELECT 'bfl-bankruptcy-v14', "packageId", "title"
FROM "DocumentPackageVersion" WHERE "version" = 'bfl-bankruptcy-v13';

INSERT INTO "DocumentTemplateVersion" ("version", "templateId", "title", "checksum")
SELECT versions.new_version, template."templateId", template."title", versions.checksum
FROM "DocumentTemplateVersion" AS template
JOIN bfl_layout_versions AS versions ON versions.old_version = template."version";

INSERT INTO "PackageDocument" ("packageVersion", "templateVersion", "position")
SELECT 'bfl-bankruptcy-v14', versions.new_version, doc."position"
FROM "PackageDocument" AS doc
JOIN bfl_layout_versions AS versions ON versions.old_version = doc."templateVersion"
WHERE doc."packageVersion" = 'bfl-bankruptcy-v13';

INSERT INTO "DocumentTemplatePlaceholder" ("templateVersion", "tag", "field", "placeholder")
SELECT versions.new_version, binding."tag", binding."field", binding."placeholder"
FROM "DocumentTemplatePlaceholder" AS binding
JOIN bfl_layout_versions AS versions ON versions.old_version = binding."templateVersion";

INSERT INTO "DocumentTemplatePlaceholder" ("templateVersion", "tag", "field", "placeholder") VALUES
  ('bfl-statement-v12', 'attachmentHeading', 'attachmentHeading', 'identity'),
  ('bfl-statement-v12', 'attachmentTail.description', 'attachmentTail.description', 'identity');

INSERT INTO "DocumentTemplateRequirement" ("templateVersion", "key", "documentKind", "label", "applicability", "position")
SELECT versions.new_version, req."key", req."documentKind", req."label", req."applicability", req."position"
FROM "DocumentTemplateRequirement" AS req
JOIN bfl_layout_versions AS versions ON versions.old_version = req."templateVersion";

COMMIT;
