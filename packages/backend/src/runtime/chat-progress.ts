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
  const readers = new Set<RedisClient>();
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
    async subscribe(scope, after, signal, receive) {
      const stream = key(scope);
      const streams = z.record(z.string(), streamRows);
      const reader = new RedisClient(url, {
        connectionTimeout: 2000,
        autoReconnect: false,
        enableOfflineQueue: false,
      });
      readers.add(reader);
      const abort = () => {
        reader.close();
      };
      signal.addEventListener('abort', abort, { once: true });
      try {
        signal.throwIfAborted();
        await reader.connect();
        let cursor = after;
        while (!signal.aborted) {
          const result: unknown = await reader.send('XREAD', [
            'COUNT',
            '64',
            'BLOCK',
            '0',
            'STREAMS',
            stream,
            cursor,
          ]);
          const rows = streams.parse(result)[stream] ?? [];
          const decoded = rows.map(([id, [, payload]]) => ({
            id,
            delta: chatProgressSchema.parse(JSON.parse(payload)),
          }));
          cursor = decoded.at(-1)?.id ?? cursor;
          receive(decoded);
        }
      } catch (error) {
        if (!signal.aborted) throw error;
      } finally {
        signal.removeEventListener('abort', abort);
        readers.delete(reader);
        reader.close();
      }
    },
    async erase(scope) {
      await connect();
      await redis.del(key(scope));
    },
    close() {
      for (const reader of readers) reader.close();
      redis.close();
    },
  };
}
