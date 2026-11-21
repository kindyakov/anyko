import { RedisClient } from 'bun';
import { z } from 'zod';

import { type ChatProgressFeed, chatProgressSchema } from '../modules/agents';

const streamRows = z.array(
  z.tuple([
    z.string().regex(/^\d+-\d+$/u),
    z.tuple([z.literal('delta'), z.string()]),
  ]),
);
const append = `
redis.call('XADD', KEYS[1], 'MAXLEN', '512', '*', 'delta', ARGV[1])
redis.call('EXPIRE', KEYS[1], '300')
`;

export function createChatProgressFeed(
  url: string,
): ChatProgressFeed & { close(): void } {
  const redis = new RedisClient(url, {
    connectionTimeout: 2000,
    enableOfflineQueue: false,
  });
  let connecting: Promise<void> | undefined;
  const connect = () => {
    if (redis.connected) return Promise.resolve();
    connecting ??= redis.connect().finally(() => {
      connecting = undefined;
    });
    return connecting;
  };
  const key = ({
    workspaceId,
    workId,
  }: {
    workspaceId: string;
    workId: string;
  }) => `anyko:chat-progress:${workspaceId}:${workId}`;
  return {
    async append(scope, delta) {
      await connect();
      await redis.send('EVAL', [
        append,
        '1',
        key(scope),
        JSON.stringify(delta),
      ]);
    },
    async read(scope, after) {
      await connect();
      const raw: unknown = await redis.send('XRANGE', [
        key(scope),
        `(${after}`,
        '+',
        'COUNT',
        '64',
      ]);
      const rows = streamRows.parse(raw);
      return rows.map(([id, [, payload]]) => ({
        id,
        delta: chatProgressSchema.parse(JSON.parse(payload)),
      }));
    },
    async erase(scope) {
      await connect();
      await redis.del(key(scope));
    },
    close() {
      redis.close();
    },
  };
}
