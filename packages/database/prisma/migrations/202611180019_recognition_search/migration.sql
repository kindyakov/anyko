BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "SourceDocument_active_page_idx"
  ON "SourceDocument" ("workspaceId", "createdAt" DESC, id DESC)
  WHERE "deletedAt" IS NULL;
CREATE INDEX "SourceDocument_active_format_page_idx"
  ON "SourceDocument" ("workspaceId", (split_part("sourceKey", '.', -1)), "createdAt" DESC, id DESC)
  WHERE "deletedAt" IS NULL;
CREATE INDEX "SourceDocument_active_filename_trgm_idx"
  ON "SourceDocument" USING GIN ((casefold(filename COLLATE pg_catalog.pg_unicode_fast)) gin_trgm_ops)
  WHERE "deletedAt" IS NULL;

COMMIT;
