ALTER TABLE "DocumentDeletion"
    ADD COLUMN "threadIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
