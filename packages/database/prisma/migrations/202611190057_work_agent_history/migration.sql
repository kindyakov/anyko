CREATE TABLE "WorkAgentEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "interactionId" TEXT NOT NULL,
    "documentId" TEXT,
    "stage" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "cachedInputTokens" INTEGER,
    "reasoningTokens" INTEGER,
    "input" TEXT,
    "output" TEXT,
    "errorCode" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkAgentEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkAgentEvent_workspaceId_workId_runId_createdAt_id_idx"
ON "WorkAgentEvent"("workspaceId", "workId", "runId", "createdAt", "id");

CREATE INDEX "WorkAgentEvent_workspaceId_workId_sessionId_idx"
ON "WorkAgentEvent"("workspaceId", "workId", "sessionId");

ALTER TABLE "WorkAgentEvent" ADD CONSTRAINT "WorkAgentEvent_session_fkey"
FOREIGN KEY ("workspaceId", "workId", "sessionId") REFERENCES "WorkAgentSession"("workspaceId", "workId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkAgentEvent" ADD CONSTRAINT "WorkAgentEvent_run_fkey"
FOREIGN KEY ("workspaceId", "runId") REFERENCES "Run"("workspaceId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;
