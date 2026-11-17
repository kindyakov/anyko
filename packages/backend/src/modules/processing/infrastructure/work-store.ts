import { z } from 'zod';

import type { Database } from '@anyko/database';

import type { WorkProcessingStore } from '..';
import { type Clock, systemClock } from '../../../platform/clock';
import { uuidV7 } from '../../../platform/ids';
import { transactionHandle, type Tx } from '../../../platform/transactions';
import { stepOutputSchema, workRunSchema } from '../application/work-ports';

type Connection = Pick<
  Database,
  'workRun' | 'workStep' | 'workOutbox' | 'workAgentThread' | '$executeRaw'
>;
const kindSchema = z.enum(['analysis', 'generation']);
export function createWorkProcessingStore(
  db: Connection,
  deps: { newId(): string; clock: Clock } = {
    newId: uuidV7,
    clock: systemClock,
  },
): WorkProcessingStore {
  return {
    async start(input) {
      await db.workRun.create({
        data: {
          id: input.id,
          workspaceId: input.workspaceId,
          workId: input.workId,
          kind: input.kind,
          inputRevision: input.inputRevision,
          settingsRevision: input.settingsRevision,
          generationId: input.generationId,
          documentIds: input.documentIds,
          modelSnapshot: input.modelSnapshot,
          initiatedBy: input.actorId,
          correlationId: input.correlationId,
          outbox: { create: { id: deps.newId() } },
        },
      });
    },
    async claim(workspaceId, id) {
      const token = deps.newId();
      if (
        !(
          await db.workRun.updateMany({
            where: { workspaceId, id, status: 'queued' },
            data: {
              status: 'running',
              attemptToken: token,
              leaseUntil: new Date(deps.clock.now().getTime() + 1_800_000),
            },
          })
        ).count
      )
        return null;
      const row = await db.workRun.findFirstOrThrow({
        where: { workspaceId, id, attemptToken: token },
      });
      return {
        id: row.id,
        workspaceId,
        workId: row.workId,
        kind: kindSchema.parse(row.kind),
        inputRevision: row.inputRevision,
        settingsRevision: row.settingsRevision,
        generationId: row.generationId,
        documentIds: z.array(z.uuid()).parse(row.documentIds),
        correlationId: row.correlationId,
        attemptToken: token,
      };
    },
    async active(workspaceId, workId) {
      return (
        (await db.workRun.count({
          where: { workspaceId, workId, status: { in: ['queued', 'running'] } },
        })) > 0
      );
    },
    async fence(run) {
      const changed = await db.workRun.updateMany({
        where: {
          workspaceId: run.workspaceId,
          id: run.id,
          attemptToken: run.attemptToken,
          status: 'running',
        },
        data: { updatedAt: deps.clock.now() },
      });
      if (changed.count !== 1) throw new Error('STALE_WORK_ATTEMPT');
    },
    async valid(run) {
      return (
        (await db.workRun.count({
          where: {
            workspaceId: run.workspaceId,
            id: run.id,
            attemptToken: run.attemptToken,
            status: 'running',
          },
        })) === 1
      );
    },
    async finish(run, status, errorCode) {
      await db.workRun.updateMany({
        where: {
          workspaceId: run.workspaceId,
          id: run.id,
          attemptToken: run.attemptToken,
          status: 'running',
        },
        data: {
          status,
          errorCode: errorCode ?? null,
          attemptToken: null,
          leaseUntil: null,
        },
      });
    },
    async step(run, input) {
      if (!(await this.valid(run))) throw new Error('STALE_WORK_ATTEMPT');
      const documentId = input.documentId ?? '';
      const data = {
        status: input.status,
        errorCode: input.errorCode ?? null,
        ...(input.usage ? { usage: input.usage } : {}),
        ...(input.output
          ? { output: stepOutputSchema.parse(input.output) }
          : {}),
      };
      await db.workStep.upsert({
        where: {
          workspaceId_runId_stage_documentId: {
            workspaceId: run.workspaceId,
            runId: run.id,
            stage: input.stage,
            documentId,
          },
        },
        update: data,
        create: {
          id: deps.newId(),
          workspaceId: run.workspaceId,
          runId: run.id,
          stage: input.stage,
          documentId,
          ...data,
        },
      });
    },
    async cached(run, documentId, stage, sourceDigest) {
      const row = await db.workStep.findFirst({
        where: {
          workspaceId: run.workspaceId,
          documentId,
          stage,
          status: { in: ['succeeded', 'skipped'] },
          output: { path: ['sourceDigest'], equals: sourceDigest },
          run: {
            workId: run.workId,
            settingsRevision: run.settingsRevision,
          },
        },
        orderBy: { updatedAt: 'desc' },
      });
      return row?.output ? stepOutputSchema.parse(row.output) : null;
    },
    async list(workspaceId, workId) {
      return (
        await db.workRun.findMany({
          where: { workspaceId, workId },
          include: { steps: { orderBy: { updatedAt: 'asc' } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      ).map((row) =>
        workRunSchema.parse({
          ...row,
          steps: row.steps.map((step) => ({
            ...step,
            documentId: step.documentId || null,
            visuals: step.output
              ? stepOutputSchema.parse(step.output).visuals
              : [],
          })),
          createdAt: row.createdAt.toISOString(),
        }),
      );
    },
    async delivery() {
      const row = await db.workOutbox.findFirst({
        where: {
          deliveredAt: null,
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: deps.clock.now() } }],
        },
      });
      if (!row) return null;
      const token = deps.newId();
      const changed = await db.workOutbox.updateMany({
        where: {
          id: row.id,
          deliveredAt: null,
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: deps.clock.now() } }],
        },
        data: {
          leaseToken: token,
          leaseUntil: new Date(deps.clock.now().getTime() + 10000),
        },
      });
      return changed.count
        ? { id: row.id, workspaceId: row.workspaceId, runId: row.runId, token }
        : null;
    },
    async delivered(id, token) {
      await db.workOutbox.updateMany({
        where: { id, leaseToken: token },
        data: {
          deliveredAt: deps.clock.now(),
          leaseUntil: null,
          leaseToken: null,
        },
      });
    },
    async release(id, token) {
      await db.workOutbox.updateMany({
        where: { id, leaseToken: token },
        data: { leaseUntil: null, leaseToken: null },
      });
    },
    async reconcile() {
      // Atomic recovery: queued runs are not repeatedly republished while waiting for a consumer.
      await db.$executeRaw`WITH expired AS (
        UPDATE "WorkRun" SET "status"='queued', "attemptToken"=NULL, "leaseUntil"=NULL, "updatedAt"=(NOW() AT TIME ZONE 'UTC')
        WHERE "status"='running' AND "leaseUntil" < (NOW() AT TIME ZONE 'UTC') RETURNING "id", "workspaceId"
      ) UPDATE "WorkOutbox" AS outbox SET "deliveredAt"=NULL, "leaseUntil"=NULL, "leaseToken"=NULL
        FROM expired WHERE outbox."runId"=expired."id" AND outbox."workspaceId"=expired."workspaceId"`;
    },
    async erase(workspaceId, workId) {
      await db.workRun.deleteMany({ where: { workspaceId, workId } });
    },
    async thread(workspaceId, workId, id) {
      await db.workAgentThread.create({ data: { id, workspaceId, workId } });
    },
    async threads(workspaceId, workId) {
      return (
        await db.workAgentThread.findMany({
          where: { workspaceId, workId },
          select: { id: true },
        })
      ).map((row) => row.id);
    },
    async eraseThreads(workspaceId, workId) {
      await db.workAgentThread.deleteMany({ where: { workspaceId, workId } });
    },
  };
}

// Запуски внутри транзакции действия: токен превращается в клиент транзакции драйвера.
export function workProcessingStoreFor(tx: Tx): WorkProcessingStore {
  return createWorkProcessingStore(transactionHandle<Connection>(tx));
}
