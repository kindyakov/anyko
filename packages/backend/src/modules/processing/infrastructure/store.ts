import type { Database } from '@anyko/database';

import { type Clock, systemClock } from '../../../platform/clock';
import { transactionHandle } from '../../../platform/transactions';
import { documentOcrPolicy } from '../application/document-attempt';
import type {
  DocumentArtifacts,
  DocumentAttemptStore,
} from '../application/ports';

import {
  claimRun,
  finishRun,
  type NotifyDocumentRun,
  type RunConnection,
} from './run-engine';

export function createDocumentProcessingStore(
  db: Database,
  notifyWork?: NotifyDocumentRun,
  clock: Clock = systemClock,
): DocumentArtifacts & DocumentAttemptStore {
  return {
    async attemptIds(workspaceId, documentId) {
      return (
        await db.runAttempt.findMany({
          where: { workspaceId, documentId },
          select: { id: true },
        })
      ).map((row) => row.id);
    },
    async documentId(workspaceId, runId) {
      return (
        (
          await db.run.findFirst({
            where: { workspaceId, id: runId },
            select: { documentId: true },
          })
        )?.documentId ?? null
      );
    },
    async resultKeys(workspaceId, documentId) {
      const runs = await db.run.findMany({
        where: { workspaceId, documentId, resultKey: { not: null } },
        select: { resultKey: true },
      });
      return runs.flatMap((run) => (run.resultKey ? [run.resultKey] : []));
    },
    async stageResult(key, workspaceId) {
      await db.resultUpload.create({ data: { key, workspaceId } });
    },
    async orphanResults(before) {
      const staged = await db.resultUpload.findMany({
        where: { createdAt: { lt: before } },
        take: 20,
      });
      const owned = await db.run.findMany({
        where: { resultKey: { in: staged.map((s) => s.key) } },
        select: { resultKey: true },
      });
      const keys = new Set(owned.map((r) => r.resultKey));
      return staged
        .filter((s) => !keys.has(s.key))
        .map((s) => ({ key: s.key }));
    },
    async forgetResult(key) {
      await db.resultUpload.deleteMany({ where: { key } });
    },
    async claim(workspaceId, runId, attemptToken, leaseUntil) {
      return db.$transaction(async (tx) => {
        const run = await claimRun(tx, {
          id: runId,
          workspaceId,
          attemptToken,
          leaseUntil,
          kinds: [documentOcrPolicy.name],
          maxAttempts: documentOcrPolicy.maxRunAttempts,
        });
        if (!run?.document || !run.documentId) return null;
        await notifyWork?.(tx, workspaceId, run.documentId);
        return {
          attemptToken,
          snapshot: {
            id: runId,
            workspaceId,
            documentId: run.documentId,
            sourceKey: run.document.sourceKey,
            correlationId: run.correlationId,
          },
        };
      });
    },
    async finish(transaction, { snapshot: run, attemptToken }, outcome) {
      const tx = transactionHandle<
        RunConnection & Pick<Database, 'resultUpload'>
      >(transaction);
      if (outcome.status === 'succeeded') {
        const documents = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM "SourceDocument" WHERE id=${run.documentId} AND "workspaceId"=${run.workspaceId} AND "deletedAt" IS NULL FOR UPDATE`;
        if (documents.length !== 1) return false;
      }
      const accepted = await finishRun(tx, {
        workspaceId: run.workspaceId,
        id: run.id,
        attemptToken,
        kinds: [documentOcrPolicy.name],
        now: clock.now(),
        outcome,
      });
      if (!accepted) return false;
      if (outcome.status === 'succeeded')
        await tx.resultUpload.deleteMany({ where: { key: outcome.resultKey } });
      await notifyWork?.(
        tx,
        run.workspaceId,
        run.documentId,
        outcome.status === 'succeeded'
          ? (accepted.revision ?? undefined)
          : undefined,
      );
      return true;
    },
  };
}
