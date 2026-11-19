import type { Database } from '@anyko/database';
import type { Logger } from '@anyko/logger';

import type { AgentHistoryStore } from '../application/history';

type HistoryDb = Pick<Database, 'workAgentEvent' | 'run'>;

function usage(
  sums: {
    inputTokens: number | null;
    outputTokens: number | null;
    cachedInputTokens: number | null;
    reasoningTokens: number | null;
  },
  counts: { inputTokens: number; outputTokens: number; _all: number },
) {
  return {
    calls: counts._all,
    inputTokens: sums.inputTokens,
    outputTokens: sums.outputTokens,
    cachedInputTokens: sums.cachedInputTokens,
    reasoningTokens: sums.reasoningTokens,
    unknownInputCalls: counts._all - counts.inputTokens,
    unknownOutputCalls: counts._all - counts.outputTokens,
  };
}

type Usage = ReturnType<typeof usage>;
function sumKnown(left: number | null, right: number | null) {
  return left === null ? right : left + (right ?? 0);
}
function sumUsage(all: Usage[]) {
  return all.reduce<Usage>(
    (total, next) => ({
      calls: total.calls + next.calls,
      inputTokens: sumKnown(total.inputTokens, next.inputTokens),
      outputTokens: sumKnown(total.outputTokens, next.outputTokens),
      cachedInputTokens: sumKnown(
        total.cachedInputTokens,
        next.cachedInputTokens,
      ),
      reasoningTokens: sumKnown(total.reasoningTokens, next.reasoningTokens),
      unknownInputCalls: total.unknownInputCalls + next.unknownInputCalls,
      unknownOutputCalls: total.unknownOutputCalls + next.unknownOutputCalls,
    }),
    {
      calls: 0,
      inputTokens: null,
      outputTokens: null,
      cachedInputTokens: null,
      reasoningTokens: null,
      unknownInputCalls: 0,
      unknownOutputCalls: 0,
    },
  );
}

const totals = {
  _sum: {
    inputTokens: true,
    outputTokens: true,
    cachedInputTokens: true,
    reasoningTokens: true,
  },
  _count: { _all: true, inputTokens: true, outputTokens: true },
} as const;

export function createAgentHistoryStore(
  db: HistoryDb,
  newId: () => string,
  logger?: Pick<Logger, 'warn'>,
): AgentHistoryStore {
  return {
    record(ref) {
      return {
        async tool(event) {
          await db.workAgentEvent.create({
            data: { id: newId(), ...ref, ...event, kind: 'tool' },
            select: { id: true },
          });
        },
        observe:
          ({ imagePath, ...call }) =>
          async (input) => {
            const id = newId();
            await db.workAgentEvent.create({
              data: {
                id,
                ...ref,
                ...call,
                kind: 'provider',
                status: 'running',
                input: imagePath
                  ? JSON.stringify({
                      imagePath,
                      request: input ? (JSON.parse(input) as unknown) : null,
                    })
                  : input,
              },
              select: { id: true },
            });
            return async (result) => {
              // Erasure cascades through the session. A late response cannot recreate it.
              try {
                await db.workAgentEvent.updateMany({
                  where: { id, ...ref },
                  data: result,
                });
              } catch {
                logger?.warn({
                  event: 'work_agent_history_completion_failed',
                  jobId: ref.runId,
                  jobType: call.stage,
                  provider: call.provider,
                  model: call.model,
                });
              }
            };
          },
      };
    },
    async outcome(ref, outcome) {
      await db.workAgentEvent.create({
        data: { id: newId(), ...ref, ...outcome, kind: 'decision' },
        select: { id: true },
      });
    },
    async runs(scope, page, pageSize) {
      const where = { ...scope, kind: 'work.analysis' };
      const [rows, total] = await Promise.all([
        db.run.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: { id: true, status: true, createdAt: true },
        }),
        db.run.count({ where }),
      ]);
      return {
        items: rows.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
        })),
        total,
        page,
        pageSize,
      };
    },
    async read(ref, page, pageSize) {
      const { workspaceId, workId, runId } = ref;
      const run = await db.run.findFirst({
        where: {
          id: runId,
          workspaceId,
          workId,
          kind: { in: ['work.analysis', 'work.chat'] },
        },
        select: { id: true },
      });
      if (!run) return null;
      const [events, total, groups] = await Promise.all([
        db.workAgentEvent.findMany({
          where: ref,
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          omit: {
            workspaceId: true,
            workId: true,
            sessionId: true,
            runId: true,
          },
        }),
        db.workAgentEvent.count({ where: ref }),
        db.workAgentEvent.groupBy({
          where: { workspaceId, workId, kind: 'provider' },
          by: ['runId', 'stage', 'documentId'],
          orderBy: [{ stage: 'asc' }, { documentId: 'asc' }],
          ...totals,
        }),
      ]);
      // All three usage levels come from the same snapshot while calls are in flight.
      const usages = groups.map(
        ({ runId, stage, documentId, _sum, _count }) => ({
          runId,
          stage,
          documentId,
          usage: usage(_sum, _count),
        }),
      );
      const steps = usages
        .filter((group) => group.runId === runId)
        .map(({ stage, documentId, usage }) => ({
          stage,
          documentId,
          usage,
        }));
      return {
        items: events.map((event) => ({
          ...event,
          createdAt: event.createdAt.toISOString(),
        })),
        total,
        page,
        pageSize,
        runUsage: sumUsage(steps.map((step) => step.usage)),
        workUsage: sumUsage(usages.map((group) => group.usage)),
        steps,
      };
    },
  };
}
