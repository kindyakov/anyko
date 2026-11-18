import { z } from 'zod';

import type { Database } from '@anyko/database';

import { type Clock, systemClock } from '../../../platform/clock';
import { uuidV7 } from '../../../platform/ids';
import { transactionHandle, type Tx } from '../../../platform/transactions';
import {
  type ClaimedWorkRun,
  stepOutputSchema,
  type WorkProcessingStore,
  workRunSchema,
} from '../application/work-ports';

import { activeAttempt, claimRun, type RunConnection } from './run-engine';

type Connection = RunConnection & Pick<Database, 'runStep' | 'workAgentThread'>;
const workKinds = ['work.analysis', 'work.generation'];
const workKind = (kind: string) =>
  z.enum(['analysis', 'generation']).parse(kind.slice('work.'.length));
export function createWorkProcessingStore(
  db: Connection & Partial<Pick<Database, '$transaction'>>,
  deps: { newId(): string; clock: Clock } = {
    newId: uuidV7,
    clock: systemClock,
  },
): WorkProcessingStore {
  const atomic = <T>(operation: (tx: Connection) => Promise<T>) =>
    db.$transaction ? db.$transaction(operation) : operation(db);
  const fence = async (
    tx: Connection,
    { snapshot: run, attemptToken }: ClaimedWorkRun,
  ) => {
    const now = deps.clock.now();
    const change = await tx.run.updateMany({
      where: {
        ...activeAttempt(run.workspaceId, run.id, attemptToken, now),
        kind: { in: workKinds },
      },
      data: { updatedAt: now },
    });
    if (change.count !== 1) throw new Error('STALE_WORK_ATTEMPT');
  };
  return {
    async start(input) {
      await db.run.create({
        data: {
          id: input.id,
          workspaceId: input.workspaceId,
          workId: input.workId,
          kind: `work.${input.kind}`,
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
      const row = await atomic((tx) =>
        claimRun(tx, {
          workspaceId,
          id,
          attemptToken: token,
          kinds: workKinds,
          leaseUntil: new Date(deps.clock.now().getTime() + 1800000),
        }),
      );
      if (!row?.workId || row.inputRevision === null) return null;
      return {
        attemptToken: token,
        snapshot: {
          id: row.id,
          workspaceId,
          workId: row.workId,
          kind: workKind(row.kind),
          inputRevision: row.inputRevision,
          settingsRevision: row.settingsRevision,
          generationId: row.generationId,
          documentIds: z.array(z.uuid()).parse(row.documentIds),
          correlationId: row.correlationId,
        },
      };
    },
    async active(workspaceId, workId) {
      return (
        (await db.run.count({
          where: { workspaceId, workId, status: { in: ['queued', 'running'] } },
        })) > 0
      );
    },
    fence: (run) => fence(db, run),
    async valid({ snapshot: run, attemptToken }) {
      return (
        (await db.run.count({
          where: {
            ...activeAttempt(
              run.workspaceId,
              run.id,
              attemptToken,
              deps.clock.now(),
            ),
            kind: { in: workKinds },
          },
        })) === 1
      );
    },
    async finish({ snapshot: run, attemptToken }, { status, errorCode }) {
      const updated = await db.run.updateMany({
        where: {
          ...activeAttempt(
            run.workspaceId,
            run.id,
            attemptToken,
            deps.clock.now(),
          ),
          kind: { in: workKinds },
        },
        data: {
          status,
          errorCode: errorCode ?? null,
          attemptToken: null,
          leaseUntil: null,
        },
      });
      return updated.count === 1;
    },
    async step(claim, input) {
      await atomic(async (tx) => {
        await fence(tx, claim);
        const run = claim.snapshot;
        const documentId = input.documentId ?? '';
        const data = {
          status: input.status,
          errorCode: input.errorCode ?? null,
          ...(input.usage ? { usage: input.usage } : {}),
          ...(input.output
            ? { output: stepOutputSchema.parse(input.output) }
            : {}),
        };
        await tx.runStep.upsert({
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
      });
    },
    async cached(run, documentId, stage, sourceDigest) {
      const row = await db.runStep.findFirst({
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
        await db.run.findMany({
          where: { workspaceId, workId },
          include: { steps: { orderBy: { updatedAt: 'asc' } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      ).map((row) =>
        workRunSchema.parse({
          ...row,
          kind: workKind(row.kind),
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
    async cancel(workspaceId, workId) {
      await db.run.updateMany({
        where: { workspaceId, workId, status: { in: ['queued', 'running'] } },
        data: { status: 'cancelled', attemptToken: null, leaseUntil: null },
      });
    },
    async erase(workspaceId, workId) {
      await db.run.deleteMany({ where: { workspaceId, workId } });
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
