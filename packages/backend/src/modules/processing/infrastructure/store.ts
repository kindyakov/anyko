import type { Database } from '@anyko/database';

import { type Clock, systemClock } from '../../../platform/clock';
import type { ProcessingStore } from '../application/ports';

import {
  activeAttempt,
  claimRun,
  documentPolicy,
  type NotifyDocumentRun,
  recoverRuns,
  runDelivery,
} from './run-engine';

export function createProcessingStore(
  db: Database,
  notifyWork?: NotifyDocumentRun,
  clock: Clock = systemClock,
): ProcessingStore {
  const delivery = runDelivery(db, clock);
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
    async claim(runId, workspaceId, attemptToken, leaseUntil) {
      return db.$transaction(async (tx) => {
        const run = await claimRun(tx, {
          id: runId,
          workspaceId,
          attemptToken,
          leaseUntil,
          kinds: [documentPolicy.name],
          maxAttempts: documentPolicy.maxRunAttempts,
        });
        if (!run?.document || !run.documentId) return null;
        await notifyWork?.(tx, workspaceId, run.documentId);
        return {
          runId,
          workspaceId,
          documentId: run.documentId,
          sourceKey: run.document.sourceKey,
          attemptToken,
          correlationId: run.correlationId,
        };
      });
    },
    async complete(claim, resultKey, processorVersion) {
      return db.$transaction(async (tx) => {
        const documents = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM "SourceDocument" WHERE id=${claim.documentId} AND "workspaceId"=${claim.workspaceId} AND "deletedAt" IS NULL FOR UPDATE`;
        if (documents.length !== 1) return false;
        const result = await tx.run.updateManyAndReturn({
          where: {
            ...activeAttempt(
              claim.workspaceId,
              claim.runId,
              claim.attemptToken,
              clock.now(),
            ),
            kind: documentPolicy.name,
          },
          data: {
            status: 'succeeded',
            resultKey,
            processorVersion,
            attemptToken: null,
            leaseUntil: null,
          },
          select: { revision: true },
        });
        const [completed] = result;
        if (completed) {
          await tx.resultUpload.deleteMany({ where: { key: resultKey } });
          await notifyWork?.(
            tx,
            claim.workspaceId,
            claim.documentId,
            completed.revision ?? undefined,
          );
        }
        return completed !== undefined;
      });
    },
    async fail(claim, errorCode) {
      await db.$transaction(async (tx) => {
        const result = await tx.run.updateMany({
          where: {
            ...activeAttempt(
              claim.workspaceId,
              claim.runId,
              claim.attemptToken,
              clock.now(),
            ),
            kind: documentPolicy.name,
          },
          data: {
            status: 'failed',
            errorCode,
            attemptToken: null,
            leaseUntil: null,
          },
        });
        if (result.count === 1)
          await notifyWork?.(tx, claim.workspaceId, claim.documentId);
      });
    },
    reserveDelivery: (token, leaseUntil) =>
      delivery.reserve(token, clock.now(), leaseUntil),
    delivered: delivery.delivered,
    releaseDelivery: delivery.release,
    reconcile: () =>
      db.$transaction((tx) =>
        recoverRuns(tx, [documentPolicy], clock.now(), notifyWork),
      ),
  };
}
