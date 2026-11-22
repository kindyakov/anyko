import { z } from 'zod';

import type { DatabasePool } from '@anyko/database';

import type {
  DatabaseEventSignal,
  SubscribeDatabaseEvents,
} from '../modules/works';

const channel = 'anyko_runtime_events';
const signalSchema = z.object({
  workspaceId: z.string(),
  workId: z.string().optional(),
  documentId: z.string().optional(),
  eventKind: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  kind: z.enum(['work', 'history', 'recognition', 'work-list']),
});

export function createDatabaseEvents(pool: DatabasePool) {
  const subscribers = new Set<Parameters<SubscribeDatabaseEvents>[0]>();
  const controller = new AbortController();
  let task: Promise<void> | undefined;
  let connected = false;
  const isOpen = () => !controller.signal.aborted;
  const broadcast = (signal: DatabaseEventSignal | null | 'unavailable') => {
    for (const receive of subscribers) receive(signal);
  };

  async function listen() {
    while (isOpen()) {
      try {
        const client = await pool.connect();
        try {
          const disconnected = Promise.withResolvers<null>();
          const disconnect = () => {
            disconnected.resolve(null);
          };
          const notify = (message: {
            channel: string;
            payload?: string | undefined;
          }) => {
            if (message.channel !== channel || !message.payload) return;
            try {
              const event = signalSchema.safeParse(JSON.parse(message.payload));
              if (event.success) broadcast(event.data);
            } catch {
              // Ignore malformed notifications on the internal channel.
            }
          };
          client.on('error', disconnect);
          client.on('end', disconnect);
          client.on('notification', notify);
          controller.signal.addEventListener('abort', disconnect, {
            once: true,
          });
          try {
            if (!isOpen()) break;
            await client.query('LISTEN anyko_runtime_events');
            connected = true;
            broadcast(null);
            await disconnected.promise;
          } finally {
            controller.signal.removeEventListener('abort', disconnect);
          }
        } finally {
          client.release(true);
        }
      } catch {
        // Retry the dedicated listener. On reconnect subscribers reread their journals.
      }
      if (connected) {
        connected = false;
        broadcast('unavailable');
      }
      if (isOpen()) await Bun.sleep(500);
    }
  }

  const subscribe: SubscribeDatabaseEvents = (receive) => {
    subscribers.add(receive);
    receive(connected ? null : 'unavailable');
    task ??= listen();
    return () => {
      subscribers.delete(receive);
    };
  };

  return {
    subscribe,
    async stop() {
      controller.abort();
      await task;
    },
  };
}
