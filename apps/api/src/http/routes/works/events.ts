import type { createAccess } from '@anyko/backend/access';
import type { WorkId } from '@anyko/backend/ids';
import type { WorkspaceScope } from '@anyko/backend/scope';
import type { WorkChat } from '@anyko/backend/workflows';
import type {
  SubscribeDatabaseEvents,
  WorksModule,
} from '@anyko/backend/works';

import { openEventStream } from './sse';

export function workEventStream(input: {
  request: Request;
  scope: WorkspaceScope;
  workId: WorkId;
  after: string;
  chatAfter: string;
  chat: WorkChat;
  subscribeEvents: SubscribeDatabaseEvents;
  works: WorksModule;
  access: ReturnType<typeof createAccess>;
}) {
  return openEventStream({
    ...input,
    allowed: (scope) => scope.has('works.read'),
    async run(stream) {
      let cursor = input.after;
      let chatCursor = input.chatAfter;
      const eventId = () =>
        chatCursor === '0-0' ? cursor : cursor + '|' + chatCursor;
      const changes = new Set(['work']);
      const transport = {
        listenerConnected: false,
        progressUnavailable: false,
      };
      const isOpen = () => !stream.signal.aborted;
      const markProgressReady = () => {
        if (transport.progressUnavailable && transport.listenerConnected)
          stream.send('ready', {});
        transport.progressUnavailable = false;
      };
      let pending = Promise.withResolvers<null>();
      const wake = () => {
        pending.resolve(null);
      };
      stream.signal.addEventListener('abort', wake, { once: true });
      const unsubscribe = input.subscribeEvents((event) => {
        if (event === 'unavailable') {
          transport.listenerConnected = false;
          stream.send('degraded', {});
          return;
        }
        if (
          event &&
          (event.workspaceId !== input.scope.workspaceId ||
            event.workId !== input.workId)
        )
          return;
        if (!event) {
          transport.listenerConnected = true;
          if (!transport.progressUnavailable) stream.send('ready', {});
        }
        if (!event || event.kind === 'work') changes.add('work');
        if (event?.kind === 'history') changes.add('history');
        wake();
      });
      let reader: AbortController | undefined;
      try {
        while (isOpen()) {
          if (!changes.size) {
            await pending.promise;
            pending = Promise.withResolvers<null>();
            continue;
          }
          if (changes.delete('history')) {
            stream.send('changed', { kind: 'agent.history' });
          }
          if (!changes.delete('work')) continue;
          let events;
          do {
            events = await input.works.queries.events(
              stream.scope(),
              input.workId,
              cursor,
            );
            for (const event of events) {
              cursor = event.id;
              stream.send('changed', { kind: event.kind }, eventId());
            }
          } while (events.length === 100 && isOpen());
          const progress = input.chat.progress;
          const active =
            progress &&
            (await input.chat.progressActive?.(stream.scope(), input.workId));
          if (!active) {
            reader?.abort();
            reader = undefined;
            markProgressReady();
          } else if (!reader && isOpen()) {
            const attempt = new AbortController();
            reader = attempt;
            void progress(
              stream.scope(),
              input.workId,
              chatCursor,
              AbortSignal.any([stream.signal, attempt.signal]),
              (rows) => {
                markProgressReady();
                for (const row of rows) {
                  chatCursor = row.id;
                  stream.send('chat-progress', row.delta, eventId());
                }
              },
            ).catch(() => {
              if (attempt.signal.aborted || !isOpen()) return;
              reader = undefined;
              transport.progressUnavailable = true;
              stream.send('degraded', {});
            });
          }
        }
      } finally {
        reader?.abort();
        unsubscribe();
        stream.signal.removeEventListener('abort', wake);
      }
    },
  });
}
