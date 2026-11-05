import type { Database } from '@anyko/database';
import type { ProcessingStore } from '../application/ports';

export function createProcessingStore(db: Database): ProcessingStore {
  return {
    async attemptIds(workspaceId, documentId) {
      return (
        await db.processorAttempt.findMany({
          where: { workspaceId, documentId },
          select: { id: true },
        })
      ).map((row) => row.id);
    },
    async documentId(workspaceId, runId) {
      return (
        (
          await db.processingRun.findFirst({
            where: { workspaceId, id: runId },
            select: { documentId: true },
          })
        )?.documentId ?? null
      );
    },
    async resultKeys(workspaceId, documentId) {
      const runs = await db.processingRun.findMany({
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
      const owned = await db.processingRun.findMany({
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
        const claimed = await tx.processingRun.updateMany({
          where: {
            id: runId,
            workspaceId,
            status: 'queued',
            document: { deletedAt: null },
            attempts: { lt: 3 },
          },
          data: {
            status: 'running',
            attemptToken,
            leaseUntil,
            attempts: { increment: 1 },
            errorCode: null,
          },
        });
        if (claimed.count !== 1) return null;
        const run = await tx.processingRun.findUniqueOrThrow({
          where: { workspaceId_id: { workspaceId, id: runId } },
          include: { document: { select: { sourceKey: true } } },
        });
        await tx.processorAttempt.create({
          data: { id: attemptToken, workspaceId, documentId: run.documentId },
        });
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
        const result = await tx.processingRun.updateMany({
          where: {
            id: claim.runId,
            workspaceId: claim.workspaceId,
            status: 'running',
            attemptToken: claim.attemptToken,
            leaseUntil: { gt: new Date() },
          },
          data: {
            status: 'succeeded',
            resultKey,
            processorVersion,
            attemptToken: null,
            leaseUntil: null,
          },
        });
        if (result.count === 1)
          await tx.resultUpload.deleteMany({ where: { key: resultKey } });
        return result.count === 1;
      });
    },
    async fail(claim, errorCode) {
      await db.processingRun.updateMany({
        where: {
          id: claim.runId,
          workspaceId: claim.workspaceId,
          status: 'running',
          attemptToken: claim.attemptToken,
        },
        data: {
          status: 'failed',
          errorCode,
          attemptToken: null,
          leaseUntil: null,
        },
      });
    },
    async reserveDelivery(token, leaseUntil) {
      const row = await db.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<
          { id: string; workspaceId: string; runId: string }[]
        >`SELECT o.id,o."workspaceId",o."runId" FROM "ProcessingOutbox" o JOIN "ProcessingRun" r ON r.id=o."runId" AND r."workspaceId"=o."workspaceId" WHERE o."deliveredAt" IS NULL AND (o."leaseUntil" IS NULL OR o."leaseUntil" < NOW()) AND r.status='queued' ORDER BY o."createdAt" FOR UPDATE OF o SKIP LOCKED LIMIT 1`;
        const selected = rows[0];
        if (!selected) return null;
        await tx.processingOutbox.update({
          where: { id: selected.id },
          data: { leaseUntil, leaseToken: token },
        });
        return selected;
      });
      return row ? { ...row, token } : null;
    },
    async delivered(id, token) {
      await db.processingOutbox.updateMany({
        where: { id, leaseToken: token },
        data: { deliveredAt: new Date(), leaseUntil: null, leaseToken: null },
      });
    },
    async releaseDelivery(id, token) {
      await db.processingOutbox.updateMany({
        where: { id, leaseToken: token },
        data: { leaseUntil: null, leaseToken: null },
      });
    },
    async reconcile() {
      await db.$transaction(async (tx) => {
        // Redis acknowledgements are delivery hints, not durable execution state.
        // A queued operation whose last delivery has aged out may have lost its
        // Redis job; republish it without stealing an active dispatcher lease.
        const now = new Date();
        await tx.processingOutbox.updateMany({
          where: {
            deliveredAt: { lt: new Date(now.getTime() - 30000) },
            OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
            run: { status: 'queued' },
          },
          data: { deliveredAt: null, leaseUntil: null, leaseToken: null },
        });
        const exhausted = await tx.processingRun.findMany({
          where: {
            status: 'running',
            leaseUntil: { lt: new Date() },
            attempts: { gte: 3 },
          },
          select: { id: true },
        });
        await tx.processingRun.updateMany({
          where: { id: { in: exhausted.map((r) => r.id) }, status: 'running' },
          data: {
            status: 'failed',
            errorCode: 'ATTEMPTS_EXHAUSTED',
            attemptToken: null,
            leaseUntil: null,
          },
        });
        const expired = await tx.processingRun.findMany({
          where: {
            status: 'running',
            leaseUntil: { lt: new Date() },
            attempts: { lt: 3 },
          },
          select: { id: true },
        });
        if (expired.length) {
          const ids = expired.map((r) => r.id);
          await tx.processingRun.updateMany({
            where: {
              id: { in: ids },
              status: 'running',
              leaseUntil: { lt: new Date() },
            },
            data: { status: 'queued', attemptToken: null, leaseUntil: null },
          });
          await tx.processingOutbox.updateMany({
            where: { runId: { in: ids } },
            data: { deliveredAt: null, leaseUntil: null, leaseToken: null },
          });
        }
      });
    },
  };
}
