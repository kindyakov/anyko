CREATE INDEX "SourceDocument_workspace_checksum_page_idx"
ON "SourceDocument" ("workspaceId", "sourceChecksum", "deletedAt", "createdAt", "id");
