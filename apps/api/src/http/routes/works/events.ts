import type { createAccess } from '@anyko/backend/access';
import type { WorkId } from '@anyko/backend/ids';
import type { WorkspaceScope } from '@anyko/backend/scope';
import type { WorkApi } from '@anyko/backend/works';

import { transportErrorCodes } from '../../errors';

const connections = new Map<string, number>();
export function workEventStream(input: {
  request: Request;
  scope: WorkspaceScope;
  workId: WorkId;
  after: string;
  works: WorkApi;
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
      const end = Date.now() + 25000;
      try {
        while (!controller.signal.aborted && Date.now() < end) {
          // Область пересчитывается на каждом круге: отозванное участие или право прерывают поток.
          const session = await input.access.session(input.request.headers);
          const scope =
            session && input.access.scope(session, input.scope.workspaceId);
          if (!scope || scope.userId !== input.scope.userId) break;
          const events = await input.works.events(scope, input.workId, cursor);
          for (const event of events) {
            output.enqueue(
              encoder.encode(
                `id: ${event.id}\nevent: changed\ndata: ${JSON.stringify({ kind: event.kind })}\n\n`,
              ),
            );
            cursor = event.id;
          }
          if (!events.length) output.enqueue(encoder.encode(': heartbeat\n\n'));
          await new Promise((resolve) => setTimeout(resolve, 1000));
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
