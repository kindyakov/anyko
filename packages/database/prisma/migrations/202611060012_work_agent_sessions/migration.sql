CREATE TABLE "WorkAgentSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "workId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "context" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkAgentSession_work_fkey" FOREIGN KEY ("workspaceId", "workId") REFERENCES "Work"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WorkAgentSession_workspaceId_workId_key" ON "WorkAgentSession"("workspaceId", "workId");
CREATE UNIQUE INDEX "WorkAgentSession_workspaceId_workId_id_key" ON "WorkAgentSession"("workspaceId", "workId", "id");
CREATE TABLE "WorkAgentTurn" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "workId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "trigger" TEXT NOT NULL,
  "context" JSONB NOT NULL,
  "output" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkAgentTurn_session_fkey" FOREIGN KEY ("workspaceId", "workId", "sessionId") REFERENCES "WorkAgentSession"("workspaceId", "workId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WorkAgentTurn_sessionId_runId_key" ON "WorkAgentTurn"("sessionId", "runId");
CREATE UNIQUE INDEX "WorkAgentTurn_sessionId_revision_key" ON "WorkAgentTurn"("sessionId", "revision");
CREATE INDEX "WorkAgentTurn_workspaceId_workId_idx" ON "WorkAgentTurn"("workspaceId", "workId");
