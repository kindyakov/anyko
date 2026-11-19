import type { Database } from '@anyko/database';

import type { AgentChatStore } from '../application/chat';

export function createAgentChatStore(
  db: Pick<Database, 'run' | 'workChatTurn'>,
): AgentChatStore {
  return {
    async create(data) {
      await db.workChatTurn.create({ data, select: { runId: true } });
    },
    get: (where) =>
      db.workChatTurn.findFirst({
        where,
        select: { sessionId: true, userText: true },
      }),
    async answer(where, answer) {
      const changed = await db.workChatTurn.updateMany({
        where: { ...where, answer: null },
        data: { answer },
      });
      if (changed.count !== 1) throw new Error('STALE_CHAT_TURN');
    },
    async context(ref) {
      const rows = await db.workChatTurn.findMany({
        where: { ...ref, answer: { not: null }, run: { status: 'succeeded' } },
        orderBy: [{ run: { createdAt: 'desc' } }, { runId: 'desc' }],
        take: 12,
        select: { userText: true, answer: true },
      });
      return rows
        .reverse()
        .flatMap(({ userText, answer }) =>
          answer === null ? [] : [{ userText, answer }],
        );
    },
    async timeline(scope, page, pageSize) {
      const where = {
        ...scope,
        OR: [
          { kind: 'work.analysis' },
          { kind: 'work.chat', chatTurn: { isNot: null } },
        ],
      };
      const [rows, total] = await Promise.all([
        db.run.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            status: true,
            errorCode: true,
            createdAt: true,
            chatTurn: { select: { userText: true, answer: true } },
          },
        }),
        db.run.count({ where }),
      ]);
      return {
        items: rows.map(({ id, createdAt, chatTurn, ...row }) => ({
          ...row,
          runId: id,
          createdAt: createdAt.toISOString(),
          kind: chatTurn ? 'chat' : 'analysis',
          userText: chatTurn?.userText ?? null,
          answer: chatTurn?.answer ?? null,
        })),
        total,
      };
    },
  };
}
