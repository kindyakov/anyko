import { z } from 'zod';

export class ProviderStreamIdleError extends Error {
  override name = 'AbortError';
}

const streamEvent = z.object({
  choices: z.array(
    z.object({
      delta: z
        .object({
          content: z.string().nullish(),
          reasoning: z.string().nullish(),
          reasoning_content: z.string().nullish(),
          tool_calls: z
            .array(
              z.object({
                function: z
                  .object({
                    arguments: z.string().optional(),
                  })
                  .optional(),
              }),
            )
            .nullish(),
        })
        .nullish(),
    }),
  ),
});

function countsAsProgress(payload: string) {
  try {
    const value: unknown = JSON.parse(payload);
    return streamEvent
      .safeParse(value)
      .data?.choices.some(({ delta }) =>
        Boolean(
          delta?.content ||
          delta?.reasoning ||
          delta?.reasoning_content ||
          delta?.tool_calls?.some((call) => call.function?.arguments),
        ),
      );
  } catch {
    return false;
  }
}

export function isProviderStream(response: Response) {
  return (
    response.headers.get('content-type')?.includes('text/event-stream') === true
  );
}

function parseSseData(onData: (data: string) => void) {
  let pending = '';
  let skipLf = false;
  let data: string[] = [];
  return (text: string) => {
    if (!text) return;
    pending += skipLf && text.startsWith('\n') ? text.slice(1) : text;
    skipLf = text.endsWith('\r');
    let start = 0;
    for (const match of pending.matchAll(/\r\n|\r|\n/gu)) {
      const line = pending.slice(start, match.index);
      start = match.index + match[0].length;
      if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /u, ''));
      if (!line && data.length) {
        onData(data.join('\n'));
        data = [];
      }
    }
    pending = pending.slice(start);
  };
}

export function providerStreamData(raw: string) {
  const events: string[] = [];
  const parse = parseSseData((data) => {
    if (data.trim() !== '[DONE]') events.push(data);
  });
  parse(raw);
  return events;
}

function sseProgress(onProgress: () => void) {
  const decoder = new TextDecoder();
  const parse = parseSseData((data) => {
    if (countsAsProgress(data)) onProgress();
  });
  return (bytes: Uint8Array) => {
    parse(decoder.decode(bytes, { stream: true }));
  };
}

/** Pass through every byte. Finish reporting before the downstream stream ends. */
function passThrough(
  response: Response,
  onChunk: (bytes: Uint8Array) => void,
  onFinish: (error?: unknown) => void | Promise<void>,
  signal?: AbortSignal,
) {
  const reader = response.body?.getReader();
  if (!reader) return response;
  let completion: Promise<void> | undefined;
  let cancelled = false;
  const finish = (error?: unknown) =>
    (completion ??= Promise.resolve()
      .then(() => onFinish(error))
      .catch(() => {}));
  const cancelReader = (reason: unknown) =>
    reader.cancel(reason).catch(() => {});
  const onAbort = () => {
    void cancelReader(signal?.reason);
  };
  const detach = () => {
    signal?.removeEventListener('abort', onAbort);
  };
  signal?.addEventListener('abort', onAbort, { once: true });
  return new Response(
    new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          signal?.throwIfAborted();
          const read = await reader.read();
          if (cancelled) return;
          signal?.throwIfAborted();
          if (read.done) {
            detach();
            await finish().then(() => {
              if (!cancelled) controller.close();
            });
          } else {
            onChunk(read.value);
            controller.enqueue(read.value);
          }
        } catch (error) {
          detach();
          await finish(error);
          if (!cancelled) controller.error(error);
        }
      },
      async cancel(reason: unknown) {
        cancelled = true;
        detach();
        await Promise.all([
          cancelReader(reason),
          finish(reason ?? new Error('STREAM_CANCELLED')),
        ]);
      },
    }),
    {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    },
  );
}

export function captureProviderStream(
  response: Response,
  report: (raw: string, error: unknown) => Promise<void>,
) {
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  return passThrough(
    response,
    (bytes) => {
      chunks.push(decoder.decode(bytes, { stream: true }));
    },
    (error) => report(chunks.join('') + decoder.decode(), error),
  );
}

export function watchProviderStream(
  transport: typeof fetch,
  idleTimeoutMs: number,
): typeof fetch {
  return Object.assign(
    async (...[request, init]: Parameters<typeof fetch>) => {
      const timeout = new AbortController();
      const parentSignal =
        init?.signal ??
        (request instanceof Request ? request.signal : undefined);
      const signal = parentSignal
        ? AbortSignal.any([parentSignal, timeout.signal])
        : timeout.signal;
      let timer: ReturnType<typeof setTimeout>;
      const stop = () => {
        clearTimeout(timer);
      };
      const refresh = () => {
        stop();
        timer = setTimeout(() => {
          timeout.abort(new ProviderStreamIdleError('LLM_STREAM_IDLE'));
        }, idleTimeoutMs);
        timer.unref();
      };
      refresh();
      try {
        const requestOptions = { ...init, signal, timeout: false as const };
        const response = await transport(request, requestOptions);
        signal.throwIfAborted();
        if (response.body)
          return passThrough(
            response,
            response.ok && isProviderStream(response)
              ? sseProgress(refresh)
              : () => {},
            stop,
            signal,
          );
        stop();
        return response;
      } catch (error) {
        stop();
        throw timeout.signal.aborted ? timeout.signal.reason : error;
      }
    },
    { preconnect: transport.preconnect },
  );
}
