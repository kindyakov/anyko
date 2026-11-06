-- CreateTable
CREATE TABLE "Work" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "inputRevision" INTEGER NOT NULL DEFAULT 0,
    "confirmedRevision" INTEGER,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Work_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkDocument" (
    "documentId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,

    CONSTRAINT "WorkDocument_pkey" PRIMARY KEY ("documentId")
);

-- CreateTable
CREATE TABLE "WorkFacts" (
    "workId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "WorkFacts_pkey" PRIMARY KEY ("workId")
);

-- CreateTable
CREATE TABLE "WorkRun" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "inputRevision" INTEGER NOT NULL,
    "settingsRevision" INTEGER,
    "generationId" TEXT,
    "documentIds" JSONB NOT NULL,
    "modelSnapshot" JSONB NOT NULL,
    "initiatedBy" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "attemptToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkStep" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "documentId" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "usage" JSONB,
    "output" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkIo" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "uncertain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkIo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOutbox" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),

    CONSTRAINT "WorkOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkEvent" (
    "id" BIGSERIAL NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkGeneration" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "confirmed" BOOLEAN NOT NULL,
    "values" JSONB NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "key" TEXT,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkArtifact" (
    "key" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkArtifact_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "WorkAgentThread" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,

    CONSTRAINT "WorkAgentThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmSettings" (
    "workspaceId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "baseURL" TEXT NOT NULL,
    "visionModel" TEXT NOT NULL,
    "extractionModel" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmSettings_pkey" PRIMARY KEY ("workspaceId","revision")
);

-- CreateIndex
CREATE INDEX "Work_workspaceId_updatedAt_idx" ON "Work"("workspaceId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Work_workspaceId_id_key" ON "Work"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "WorkDocument_workspaceId_workId_idx" ON "WorkDocument"("workspaceId", "workId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkDocument_workspaceId_documentId_key" ON "WorkDocument"("workspaceId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkFacts_workspaceId_workId_key" ON "WorkFacts"("workspaceId", "workId");

-- CreateIndex
CREATE INDEX "WorkRun_workspaceId_workId_createdAt_idx" ON "WorkRun"("workspaceId", "workId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkRun_status_leaseUntil_idx" ON "WorkRun"("status", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "WorkRun_workspaceId_id_key" ON "WorkRun"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "WorkStep_workspaceId_runId_idx" ON "WorkStep"("workspaceId", "runId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkStep_workspaceId_runId_stage_documentId_key" ON "WorkStep"("workspaceId", "runId", "stage", "documentId");

-- CreateIndex
CREATE INDEX "WorkIo_workspaceId_workId_idx" ON "WorkIo"("workspaceId", "workId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOutbox_runId_key" ON "WorkOutbox"("runId");

-- CreateIndex
CREATE INDEX "WorkOutbox_deliveredAt_leaseUntil_idx" ON "WorkOutbox"("deliveredAt", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOutbox_workspaceId_runId_key" ON "WorkOutbox"("workspaceId", "runId");

-- CreateIndex
CREATE INDEX "WorkEvent_workspaceId_workId_id_idx" ON "WorkEvent"("workspaceId", "workId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkGeneration_key_key" ON "WorkGeneration"("key");

-- CreateIndex
CREATE INDEX "WorkGeneration_workspaceId_workId_createdAt_idx" ON "WorkGeneration"("workspaceId", "workId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkArtifact_workspaceId_workId_idx" ON "WorkArtifact"("workspaceId", "workId");

-- CreateIndex
CREATE INDEX "WorkAgentThread_workspaceId_workId_idx" ON "WorkAgentThread"("workspaceId", "workId");

-- AddForeignKey
ALTER TABLE "Work" ADD CONSTRAINT "Work_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "AnykoWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkDocument" ADD CONSTRAINT "WorkDocument_workspaceId_workId_fkey" FOREIGN KEY ("workspaceId", "workId") REFERENCES "Work"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkDocument" ADD CONSTRAINT "WorkDocument_workspaceId_documentId_fkey" FOREIGN KEY ("workspaceId", "documentId") REFERENCES "SourceDocument"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkFacts" ADD CONSTRAINT "WorkFacts_workspaceId_workId_fkey" FOREIGN KEY ("workspaceId", "workId") REFERENCES "Work"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkRun" ADD CONSTRAINT "WorkRun_workspaceId_workId_fkey" FOREIGN KEY ("workspaceId", "workId") REFERENCES "Work"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkStep" ADD CONSTRAINT "WorkStep_workspaceId_runId_fkey" FOREIGN KEY ("workspaceId", "runId") REFERENCES "WorkRun"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkIo" ADD CONSTRAINT "WorkIo_workspaceId_workId_fkey" FOREIGN KEY ("workspaceId", "workId") REFERENCES "Work"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOutbox" ADD CONSTRAINT "WorkOutbox_workspaceId_runId_fkey" FOREIGN KEY ("workspaceId", "runId") REFERENCES "WorkRun"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkEvent" ADD CONSTRAINT "WorkEvent_workspaceId_workId_fkey" FOREIGN KEY ("workspaceId", "workId") REFERENCES "Work"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkGeneration" ADD CONSTRAINT "WorkGeneration_workspaceId_workId_fkey" FOREIGN KEY ("workspaceId", "workId") REFERENCES "Work"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkArtifact" ADD CONSTRAINT "WorkArtifact_workspaceId_workId_fkey" FOREIGN KEY ("workspaceId", "workId") REFERENCES "Work"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAgentThread" ADD CONSTRAINT "WorkAgentThread_workspaceId_workId_fkey" FOREIGN KEY ("workspaceId", "workId") REFERENCES "Work"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmSettings" ADD CONSTRAINT "LlmSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "AnykoWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
