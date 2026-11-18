import type { Database } from '@anyko/database';

import { type Clock, systemClock } from '../../../platform/clock';
import { uuidV7 } from '../../../platform/ids';
import type { RunJob } from '../../../platform/jobs';

export type RunConnection = Pick<
  Database,
  'run' | 'runAttempt' | 'runOutbox' | '$queryRaw'
>;
export type NotifyDocumentRun = (
  tx: object,
  workspaceId: string,
  documentId: string,
  readyRevision?: number,
) => Promise<void>;
export const documentPolicy = {
  name: 'document.ocr',
  maxRunAttempts: 3,
  redeliverQueued: true,
} as const;
type RecoveryPolicy = Pick<
  RunJob,
  'name' | 'maxRunAttempts' | 'redeliverQueued'
>;

export function activeAttempt(
  workspaceId: string,
  id: string,
  attemptToken: string | null,
  now: Date,
) {
  return {
    workspaceId,
    id,
    attemptToken,
    status: 'running',
    leaseUntil: { gt: now },
  };
}

/** All run kinds use the same conditional state change and attempt history. */
export async function claimRun(
  tx: RunConnection,
  input: {
    workspaceId: string;
    id: string;
    attemptToken: string;
    leaseUntil: Date;
    kinds: string[];
    maxAttempts?: number;
  },
) {
  const run = await tx.run.updateManyAndReturn({
    where: {
      workspaceId: input.workspaceId,
      id: input.id,
      kind: { in: input.kinds },
      status: 'queued',
      OR: [{ documentId: null }, { document: { is: { deletedAt: null } } }],
      ...(input.maxAttempts === undefined
        ? {}
        : { attempts: { lt: input.maxAttempts } }),
    },
    data: {
      status: 'running',
      attemptToken: input.attemptToken,
      leaseUntil: input.leaseUntil,
      attempts: { increment: 1 },
      errorCode: null,
    },
    include: { document: { select: { sourceKey: true } } },
  });
  const claimed = run[0];
  if (!claimed) return null;
  await tx.runAttempt.create({
    data: {
      id: input.attemptToken,
      workspaceId: claimed.workspaceId,
      runId: claimed.id,
      documentId: claimed.documentId,
    },
  });
  return claimed;
}

export function runDelivery(
  db: Database,
  clock: Clock = systemClock,
  newId: () => string = uuidV7,
) {
  async function reserve(
    token = newId(),
    now = clock.now(),
    leaseUntil = new Date(now.getTime() + 30000),
  ) {
    const rows = await db.$queryRaw<
      { id: string; workspaceId: string; runId: string }[]
    >`
      WITH pending AS (
        SELECT o.id FROM "RunOutbox" o JOIN "Run" r ON (r."workspaceId", r.id) = (o."workspaceId", o."runId")
        WHERE o."deliveredAt" IS NULL AND (o."leaseUntil" IS NULL OR o."leaseUntil" < ${now}) AND r.status = 'queued'
        ORDER BY o."createdAt", o.id FOR UPDATE OF o SKIP LOCKED LIMIT 1
      ) UPDATE "RunOutbox" o SET "leaseToken"=${token}, "leaseUntil"=${leaseUntil}
      FROM pending WHERE o.id=pending.id RETURNING o.id,o."workspaceId",o."runId"`;
    return rows[0] ? { ...rows[0], token } : null;
  }
  const acknowledge = async (id: string, token: string, delivered: boolean) => {
    await db.runOutbox.updateMany({
      where: { id, leaseToken: token },
      data: {
        ...(delivered ? { deliveredAt: clock.now() } : {}),
        leaseToken: null,
        leaseUntil: null,
      },
    });
  };
  return {
    reserve,
    delivered: (id: string, token: string) => acknowledge(id, token, true),
    release: (id: string, token: string) => acknowledge(id, token, false),
  };
}

export async function recoverRuns(
  tx: RunConnection,
  policies: readonly RecoveryPolicy[],
  now: Date,
  notify?: NotifyDocumentRun,
) {
  const byKind = new Map(policies.map((policy) => [policy.name, policy]));
  const queuedKinds = policies
    .filter((policy) => policy.redeliverQueued)
    .map((policy) => policy.name);
  if (queuedKinds.length)
    await tx.runOutbox.updateMany({
      where: {
        deliveredAt: { lt: new Date(now.getTime() - 30000) },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
        run: { status: 'queued', kind: { in: queuedKinds } },
      },
      data: { deliveredAt: null, leaseUntil: null, leaseToken: null },
    });
  const expired = await tx.run.findMany({
    where: {
      kind: { in: [...byKind.keys()] },
      status: 'running',
      leaseUntil: { lt: now },
    },
    orderBy: { leaseUntil: 'asc' },
    take: 100,
    select: {
      id: true,
      workspaceId: true,
      documentId: true,
      kind: true,
      attemptToken: true,
      attempts: true,
    },
  });
  for (const run of expired) {
    const max = byKind.get(run.kind)?.maxRunAttempts;
    const exhausted = max != null && run.attempts >= max;
    const updated = await tx.run.updateMany({
      where: {
        id: run.id,
        workspaceId: run.workspaceId,
        status: 'running',
        attemptToken: run.attemptToken,
        leaseUntil: { lt: now },
      },
      data: {
        status: exhausted ? 'failed' : 'queued',
        errorCode: exhausted ? 'ATTEMPTS_EXHAUSTED' : null,
        attemptToken: null,
        leaseUntil: null,
      },
    });
    if (updated.count !== 1) continue;
    if (!exhausted)
      await tx.runOutbox.updateMany({
        where: { workspaceId: run.workspaceId, runId: run.id },
        data: { deliveredAt: null, leaseToken: null, leaseUntil: null },
      });
    if (run.documentId) await notify?.(tx, run.workspaceId, run.documentId);
  }
}
