CREATE TABLE "DocumentIo" ("id" TEXT PRIMARY KEY,"workspaceId" TEXT NOT NULL,"documentId" TEXT NOT NULL,"requestKey" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY("workspaceId") REFERENCES "AnykoWorkspace"("id") ON DELETE RESTRICT);
CREATE INDEX "DocumentIo_workspaceId_documentId_idx" ON "DocumentIo"("workspaceId","documentId");
CREATE INDEX "DocumentIo_workspaceId_requestKey_idx" ON "DocumentIo"("workspaceId","requestKey");
