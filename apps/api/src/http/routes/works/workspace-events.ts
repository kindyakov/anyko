import type { createAccess } from '@anyko/backend/access';
import type { WorkspaceScope } from '@anyko/backend/scope';
import type { SubscribeDatabaseEvents } from '@anyko/backend/works';

import { openEventStream } from './sse';

export function workspaceEventStream(input: {
  request: Request;
  scope: WorkspaceScope;
  access: ReturnType<typeof createAccess>;
  subscribeEvents: SubscribeDatabaseEvents;
}) {
  const allowed = (scope: WorkspaceScope) =>
    scope.has('works.read') || scope.has('recognitions.use');
  if (!allowed(input.scope)) input.scope.require('works.read');
  return openEventStream({
    ...input,
    allowed,
    async run(stream) {
      const done = Promise.withResolvers<null>();
      const stop = () => {
        done.resolve(null);
      };
      stream.signal.addEventListener('abort', stop, { once: true });
      const unsubscribe = input.subscribeEvents((event) => {
        if (event === 'unavailable') {
          stream.send('degraded', {});
          return;
        }
        if (!event) stream.send('ready', {});
        if (event && event.workspaceId !== input.scope.workspaceId) return;
        if (
          (!event ||
            (event.kind === 'work' && event.eventKind !== 'chat.checkpoint') ||
            event.kind === 'work-list') &&
          stream.scope().has('works.read')
        )
          stream.send('changed', { kind: 'work-list' });
        if (
          (!event || (event.kind === 'recognition' && !event.workId)) &&
          stream.scope().has('recognitions.use')
        )
          stream.send('changed', {
            kind: 'recognition',
            documentId: event?.documentId,
          });
      });
      if (stream.signal.aborted) stop();
      try {
        await done.promise;
      } finally {
        unsubscribe();
        stream.signal.removeEventListener('abort', stop);
      }
    },
  });
}
