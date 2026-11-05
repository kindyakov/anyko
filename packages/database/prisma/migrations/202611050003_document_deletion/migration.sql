ALTER TABLE "SourceDocument" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "purgedAt" TIMESTAMP(3);
CREATE INDEX "SourceDocument_deletedAt_purgedAt_idx" ON "SourceDocument"("deletedAt", "purgedAt");
