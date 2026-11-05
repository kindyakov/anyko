CREATE TABLE "DocumentArtifact" ("key" TEXT PRIMARY KEY,"workspaceId" TEXT NOT NULL,"documentId" TEXT NOT NULL,"requestKey" TEXT,"manifestKey" TEXT,"kind" TEXT NOT NULL,"position" INTEGER,"path" TEXT,"contentType" TEXT NOT NULL,"size" INTEGER NOT NULL,"checksum" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY("workspaceId") REFERENCES "AnykoWorkspace"("id") ON DELETE RESTRICT);
CREATE INDEX "DocumentArtifact_workspaceId_documentId_idx" ON "DocumentArtifact"("workspaceId","documentId");
CREATE INDEX "DocumentArtifact_workspaceId_requestKey_idx" ON "DocumentArtifact"("workspaceId","requestKey");
CREATE INDEX "DocumentArtifact_manifestKey_position_idx" ON "DocumentArtifact"("manifestKey","position");
CREATE TABLE "ProcessorAttempt" ("id" TEXT PRIMARY KEY,"workspaceId" TEXT NOT NULL,"documentId" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY("workspaceId") REFERENCES "AnykoWorkspace"("id") ON DELETE RESTRICT);
CREATE INDEX "ProcessorAttempt_workspaceId_documentId_idx" ON "ProcessorAttempt"("workspaceId","documentId");
CREATE TABLE "DocumentDeletion" ("id" TEXT PRIMARY KEY,"workspaceId" TEXT NOT NULL,"requestKey" TEXT NOT NULL,"completedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY("workspaceId") REFERENCES "AnykoWorkspace"("id") ON DELETE RESTRICT);
CREATE UNIQUE INDEX "DocumentDeletion_workspaceId_requestKey_key" ON "DocumentDeletion"("workspaceId","requestKey");
