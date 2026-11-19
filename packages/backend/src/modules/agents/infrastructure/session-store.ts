import type { Database } from '@anyko/database';
import type { Logger } from '@anyko/logger';

import { transactionHandle, type Tx } from '../../../platform/transactions';
import {
  type AgentSessionStore,
  reconciliationSchema,
} from '../application/session';
import { agentSessionContextSchema, agentSessionSchema } from '../schemas';

import { createAgentHistoryStore } from './history-store';

type Connection = Pick<
  Database,
  'workAgentSession' | 'workAgentTurn' | 'workAgentEvent' | 'run'
>;
// Сессия работы внутри транзакции действия (создание работы): токен превращается в клиент транзакции.
export function agentSessionStoreFor(
  tx: Tx,
  newId: () => string,
): AgentSessionStore {
  return createAgentSessionStore(transactionHandle<Connection>(tx), newId);
}
export function createAgentSessionStore(
  db: Connection,
  newId: () => string,
  logger?: Pick<Logger, 'warn'>,
): AgentSessionStore {
  const view = (row: {
    id: string;
    revision: number;
    context: unknown;
    updatedAt: Date;
  }) =>
    agentSessionSchema.parse({
      id: row.id,
      revision: row.revision,
      context: row.context,
      updatedAt: row.updatedAt.toISOString(),
    });
  return {
    history: createAgentHistoryStore(db, newId, logger),
    async get(workspaceId, workId) {
      const row = await db.workAgentSession.findFirst({
        where: { workspaceId, workId },
      });
      return row ? view(row) : null;
    },
    async ensure(workspaceId, workId) {
      return view(
        await db.workAgentSession.upsert({
          where: { workspaceId_workId: { workspaceId, workId } },
          create: { id: newId(), workspaceId, workId },
          update: {},
        }),
      );
    },
    async accept(input) {
      // Invoked with the run fence inside the facts acceptance transaction.
      const changed = await db.workAgentSession.updateMany({
        where: {
          id: input.sessionId,
          workspaceId: input.workspaceId,
          workId: input.workId,
          revision: input.expectedRevision,
        },
        data: {
          revision: { increment: 1 },
          context: agentSessionContextSchema.parse(input.context),
        },
      });
      if (changed.count !== 1) throw new Error('STALE_AGENT_SESSION');
      await db.workAgentTurn.create({
        data: {
          id: newId(),
          workspaceId: input.workspaceId,
          workId: input.workId,
          sessionId: input.sessionId,
          runId: input.runId,
          threadId: input.threadId,
          revision: input.expectedRevision + 1,
          trigger: 'documents.analyzed',
          context: agentSessionContextSchema.parse(input.context),
          output: reconciliationSchema.parse(input.output),
        },
      });
    },
    async erase(workspaceId, workId) {
      await db.workAgentSession.deleteMany({ where: { workspaceId, workId } });
    },
  };
}
