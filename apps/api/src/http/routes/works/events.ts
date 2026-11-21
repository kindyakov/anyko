import type { createAccess } from '@anyko/backend/access';
import type { WorkId } from '@anyko/backend/ids';
import type { WorkspaceScope } from '@anyko/backend/scope';
import type { WorksModule } from '@anyko/backend/works';
import type { ChatProgress } from '@anyko/contracts/works';

import { transportErrorCodes } from '../../errors';

const connections = new Map<string, number>();
export function workEventStream(input: {
  request: Request;
  scope: WorkspaceScope;
  workId: WorkId;
  after: string;
  chatAfter: string;
  progressActive?:
    ((scope: WorkspaceScope, workId: WorkId) => Promise<boolean>) | undefined;
  progress?:
    | ((
        scope: WorkspaceScope,
        workId: WorkId,
        after: string,
      ) => Promise<{ id: string; delta: ChatProgress }[]>)
    | undefined;
  works: WorksModule;
  access: ReturnType<typeof createAccess>;
}) {
  const key = `${input.scope.workspaceId}:${input.scope.userId}`;
  if (
    (connections.get(key) ?? 0) >= 4 ||
    [...connections.values()].reduce((sum, count) => sum + count, 0) >= 100
  )
    return Response.json(
      { error: { code: transportErrorCodes.STREAM_LIMIT } },
      { status: 429 },
    );
  connections.set(key, (connections.get(key) ?? 0) + 1);
  const controller = new AbortController();
  const abort = () => {
    controller.abort();
  };
  input.request.signal.addEventListener('abort', abort, { once: true });
  if (input.request.signal.aborted) controller.abort();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(output) {
      let cursor = input.after;
      let chatCursor = input.chatAfter;
      const eventId = () =>
        chatCursor === '0-0' ? cursor : cursor + '|' + chatCursor;
      const end = Date.now() + 25000;
      let nextWorkPoll = 0;
      let scope: WorkspaceScope | undefined;
      let chatActive = false;
      try {
        while (!controller.signal.aborted && Date.now() < end) {
          // Область пересчитывается на каждом круге: отозванное участие или право прерывают поток.
          if (Date.now() >= nextWorkPoll) {
            const session = await input.access.session(input.request.headers);
            scope = session
              ? (input.access.scope(session, input.scope.workspaceId) ??
                undefined)
              : undefined;
            if (!scope || scope.userId !== input.scope.userId) break;
            const events = await input.works.queries.events(
              scope,
              input.workId,
              cursor,
            );
            for (const event of events) {
              cursor = event.id;
              output.enqueue(
                encoder.encode(
                  `id: ${eventId()}\nevent: changed\ndata: ${JSON.stringify({ kind: event.kind })}\n\n`,
                ),
              );
            }
            if (!events.length)
              output.enqueue(encoder.encode(': heartbeat\n\n'));
            // #95 can replace polling with push notifications. Keep idle work out of Redis.
            if (
              input.progressActive &&
              (!nextWorkPoll || events.length || chatActive)
            )
              chatActive = await input.progressActive(scope, input.workId);
            nextWorkPoll = Date.now() + 1000;
          }
          const rows =
            chatActive && scope && input.progress
              ? await input
                  .progress(scope, input.workId, chatCursor)
                  .catch(() => [])
              : [];
          for (const { id, delta } of rows) {
            chatCursor = id;
            output.enqueue(
              encoder.encode(
                `id: ${eventId()}\nevent: chat-progress\ndata: ${JSON.stringify(delta)}\n\n`,
              ),
            );
          }
          await new Promise((resolve) =>
            setTimeout(resolve, chatActive ? 200 : 1000),
          );
        }
      } catch {
        // A reconnect rechecks authentication and resumes from the last persisted cursor.
        if (!controller.signal.aborted)
          output.enqueue(encoder.encode('event: reconnect\ndata: {}\n\n'));
      } finally {
        input.request.signal.removeEventListener('abort', abort);
        const count = (connections.get(key) ?? 1) - 1;
        if (count) connections.set(key, count);
        else connections.delete(key);
        if (!controller.signal.aborted) output.close();
      }
    },
    cancel() {
      controller.abort();
    },
  });
  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    },
  });
}
