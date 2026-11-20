ALTER TABLE "Run" DROP CONSTRAINT "run_kind_state";
ALTER TABLE "Run" ADD CONSTRAINT "run_kind_state" CHECK (
  attempts >= 0 AND (
    (kind = 'document.ocr' AND status IN ('queued', 'running', 'succeeded', 'failed')
      AND attempts <= 3 AND "documentId" IS NOT NULL AND revision IS NOT NULL AND revision > 0
      AND (status <> 'succeeded' OR ("resultKey" IS NOT NULL AND "processorVersion" IS NOT NULL))
      AND "workId" IS NULL AND "inputRevision" IS NULL AND "generationId" IS NULL
      AND "documentIds" IS NULL AND "modelSnapshot" IS NULL AND "settingsRevision" IS NULL)
    OR
    (kind IN ('work.analysis', 'work.generation', 'work.chat')
      AND status IN ('queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled')
      AND "documentId" IS NULL AND revision IS NULL AND "resultKey" IS NULL AND "processorVersion" IS NULL
      AND "workId" IS NOT NULL AND "inputRevision" IS NOT NULL
      AND "documentIds" IS NOT NULL AND "modelSnapshot" IS NOT NULL
      AND (kind = 'work.generation') = ("generationId" IS NOT NULL))
  )
);

CREATE TABLE "WorkChatTurn" (
  "runId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "workId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userText" TEXT NOT NULL,
  "answer" TEXT,
  CONSTRAINT "WorkChatTurn_session_fkey" FOREIGN KEY ("workspaceId", "workId", "sessionId")
    REFERENCES "WorkAgentSession" ("workspaceId", "workId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkChatTurn_run_fkey" FOREIGN KEY ("workspaceId", "runId")
    REFERENCES "Run" ("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WorkChatTurn_workspaceId_runId_key" ON "WorkChatTurn" ("workspaceId", "runId");
CREATE INDEX "WorkChatTurn_workspaceId_workId_sessionId_idx" ON "WorkChatTurn" ("workspaceId", "workId", "sessionId");
