import type { createAccess } from '@anyko/backend/access';
import type { WorkspaceScope } from '@anyko/backend/scope';

import { transportErrorCodes } from '../../errors';

const connections = new Map<string, number>();
const accessInterval = 15000;

export function openEventStream(input: {
  request: Request;
  scope: WorkspaceScope;
  access: ReturnType<typeof createAccess>;
  allowed(scope: WorkspaceScope): boolean;
  run(stream: {
    signal: AbortSignal;
    send(event: string, data: object, id?: string): void;
    close(): void;
    scope(): WorkspaceScope;
  }): Promise<void>;
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
  const signal = controller.signal;
  const close = () => {
    controller.abort();
  };
  input.request.signal.addEventListener('abort', close, { once: true });
  if (input.request.signal.aborted) close();
  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(output) {
      let ended = false;
      const endBody = () => {
        if (!cancelled && !ended) {
          ended = true;
          output.close();
        }
      };
      signal.addEventListener('abort', endBody, { once: true });
      let current = input.scope;
      let checking = false;
      let validUntil = Date.now() + accessInterval;
      const send = (event: string, data: object, id?: string) => {
        if (signal.aborted) return;
        if (Date.now() >= validUntil || (output.desiredSize ?? 0) < -128) {
          close();
          return;
        }
        output.enqueue(
          encoder.encode(
            `${id ? 'id: ' + id + '\n' : ''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
          ),
        );
      };
      const refresh = async () => {
        if (checking || signal.aborted) return;
        checking = true;
        const checkedAt = Date.now();
        try {
          const session = await input.access.session(input.request.headers);
          const scope =
            session && input.access.scope(session, current.workspaceId);
          if (
            !scope ||
            scope.userId !== current.userId ||
            !input.allowed(scope)
          )
            close();
          else {
            current = scope;
            validUntil = checkedAt + accessInterval;
            clearTimeout(expiry);
            expiry = setTimeout(close, Math.max(0, validUntil - Date.now()));
          }
        } catch {
          close();
        } finally {
          checking = false;
        }
      };
      const authTimer = setInterval(() => {
        void refresh();
      }, 14000);
      let expiry = setTimeout(close, accessInterval);
      const heartbeat = setInterval(() => {
        if (!signal.aborted) {
          if ((output.desiredSize ?? 0) < -128) close();
          else output.enqueue(encoder.encode(': heartbeat\n\n'));
        }
      }, 10000);
      try {
        if (!signal.aborted) {
          output.enqueue(encoder.encode(': connected\n\n'));
          await input.run({ signal, send, close, scope: () => current });
        }
      } catch {
        // EventSource reconnects using its last delivered event ID.
      } finally {
        close();
        clearInterval(authTimer);
        clearTimeout(expiry);
        clearInterval(heartbeat);
        input.request.signal.removeEventListener('abort', close);
        const count = (connections.get(key) ?? 1) - 1;
        if (count) connections.set(key, count);
        else connections.delete(key);
        signal.removeEventListener('abort', endBody);
        endBody();
      }
    },
    cancel() {
      cancelled = true;
      close();
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
