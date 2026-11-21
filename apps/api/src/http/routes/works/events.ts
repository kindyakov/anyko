import type { createAccess } from '@anyko/backend/access';
import type { WorkId } from '@anyko/backend/ids';
import type { WorkspaceScope } from '@anyko/backend/scope';
import type { WorkChat } from '@anyko/backend/workflows';
import {
  type SubscribeDatabaseEvents,
  WorkError,
  type WorksModule,
} from '@anyko/backend/works';

import { openEventStream } from './sse';

function clearsChat(kind?: string) {
  return (
    kind === 'sources.deleting' ||
    kind === 'sources.erased' ||
    kind === 'work.deleting'
  );
}

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
        listenerDown: false,
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
      let reader: { runId: string; abort: AbortController } | undefined;
      let progressEpoch = 0;
      const stopProgress = () => {
        progressEpoch++;
        reader?.abort.abort();
        reader = undefined;
        chatCursor = '0-0';
      };
      const unsubscribe = input.subscribeEvents((event) => {
        if (event === 'unavailable') {
          transport.listenerConnected = false;
          transport.listenerDown = true;
          stopProgress();
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
          transport.listenerDown = false;
          if (!transport.progressUnavailable) stream.send('ready', {});
        }
        if (event?.kind === 'work' && clearsChat(event.eventKind))
          stopProgress();
        if (!event || event.kind === 'work') changes.add('work');
        if (event?.kind === 'history') changes.add('history');
        wake();
      });
      async function readProgress(
        progress: NonNullable<WorkChat['progress']>,
        runId: string,
        signal: AbortSignal,
      ) {
        const reading = () => !signal.aborted;
        while (reading()) {
          try {
            await progress(
              stream.scope(),
              input.workId,
              chatCursor,
              signal,
              (rows) => {
                if (signal.aborted) return;
                markProgressReady();
                for (const row of rows) {
                  chatCursor = row.id;
                  if (row.delta.runId === runId)
                    stream.send('chat-progress', row.delta, eventId());
                }
              },
            );
          } catch {
            // A Redis outage does not affect the durable work event stream.
          }
          if (!reading()) return;
          if (!transport.progressUnavailable) stream.send('degraded', {});
          transport.progressUnavailable = true;
          await Bun.sleep(500);
          if (!reading()) return;
          const current = await input.chat
            .progressRun?.(stream.scope(), input.workId)
            .catch(() => null);
          if (!reading()) return;
          if (current !== runId) {
            reader = undefined;
            changes.add('work');
            wake();
            return;
          }
        }
      }
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
              if (clearsChat(event.kind)) stopProgress();
              cursor = event.id;
              stream.send('changed', { kind: event.kind }, eventId());
              if (event.kind === 'work.deleting') return;
            }
          } while (events.length === 100 && isOpen());
          const progress = input.chat.progress;
          if (!progress || transport.listenerDown) continue;
          const epoch = progressEpoch;
          const runId = await input.chat.progressRun?.(
            stream.scope(),
            input.workId,
          );
          if (epoch !== progressEpoch) continue;
          if (reader && reader.runId !== runId) {
            reader.abort.abort();
            reader = undefined;
          }
          if (!runId) markProgressReady();
          else if (!reader && isOpen()) {
            const abort = new AbortController();
            reader = { runId, abort };
            void readProgress(
              progress,
              runId,
              AbortSignal.any([stream.signal, abort.signal]),
            );
          }
        }
      } catch (error) {
        if (!(error instanceof WorkError && error.code === 'NOT_FOUND'))
          throw error;
        reader?.abort.abort();
        stream.send('changed', { kind: 'work.deleting' });
      } finally {
        reader?.abort.abort();
        unsubscribe();
        stream.signal.removeEventListener('abort', wake);
      }
    },
  });
}
