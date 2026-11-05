import type { HttpFetch } from './client';
const requestHeaders = [
  'accept',
  'content-type',
  'cookie',
  'origin',
  'referer',
  'idempotency-key',
];
const responseHeaders = ['content-type', 'content-disposition', 'x-request-id'];
const REQUEST_LIMIT = 21 * 1024 * 1024;
const RESPONSE_LIMIT = 32 * 1024 * 1024;

/** Only relays to a configured origin. Never interprets user data as a destination. */
export async function proxyApiRequest(
  request: Request,
  path: readonly string[],
  origin: string,
  timeoutMs = 60000,
  fetcher: HttpFetch = fetch,
): Promise<Response> {
  const base = new URL(origin);
  if (
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.pathname !== '/' ||
    base.search ||
    base.hash
  )
    throw new Error('INVALID_API_ORIGIN');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000)
    throw new Error('INVALID_PROXY_TIMEOUT');
  const requestId = crypto.randomUUID();
  const failure = (status: number, code: string) =>
    Response.json(
      { error: { code, requestId } },
      {
        status,
        headers: { 'x-request-id': requestId, 'cache-control': 'no-store' },
      },
    );
  if (
    !path.length ||
    path.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        /[\\/]/.test(segment) ||
        Array.from(segment).some((character) => character.charCodeAt(0) < 32),
    )
  )
    return failure(400, 'INVALID_REQUEST');
  const source = new URL(request.url);
  const incomingOrigin = request.headers.get('origin');
  if (
    !['GET', 'HEAD'].includes(request.method) &&
    incomingOrigin !== null &&
    incomingOrigin !== source.origin
  )
    return failure(403, 'INVALID_ORIGIN');
  const size = request.headers.get('content-length');
  if (size !== null && (!/^\d+$/.test(size) || Number(size) > REQUEST_LIMIT))
    return failure(413, 'PAYLOAD_TOO_LARGE');
  const target = new URL(
    `/api/${path.map(encodeURIComponent).join('/')}`,
    base,
  );
  target.search = source.search;
  const headers = new Headers();
  for (const name of requestHeaders) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  const controller = new AbortController();
  const state = { timedOut: false, requestTooLarge: false };
  const abort = () => {
    controller.abort();
  };
  if (request.signal.aborted) controller.abort();
  request.signal.addEventListener('abort', abort, { once: true });
  const cleanup = () => {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', abort);
  };
  const timer = setTimeout(() => {
    state.timedOut = true;
    controller.abort();
  }, timeoutMs);
  const limited = (
    body: ReadableStream<Uint8Array>,
    limit: number,
    onLimit: () => void,
  ) => {
    let count = 0;
    return body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, stream) {
          count += chunk.byteLength;
          if (count > limit) {
            onLimit();
            throw new Error('BODY_LIMIT');
          }
          stream.enqueue(chunk);
        },
      }),
    );
  };
  try {
    const body =
      !['GET', 'HEAD'].includes(request.method) && request.body
        ? limited(request.body, REQUEST_LIMIT, () => {
            state.requestTooLarge = true;
            controller.abort();
          })
        : undefined;
    const response = await fetcher(target, {
      method: request.method,
      headers,
      signal: controller.signal,
      redirect: 'manual',
      cache: 'no-store',
      ...(body ? { body } : {}),
    });
    if (response.status >= 300 && response.status < 400) {
      cleanup();
      await response.body?.cancel();
      return failure(502, 'UPSTREAM_REDIRECT');
    }
    const outgoing = new Headers({ 'cache-control': 'no-store' });
    for (const name of responseHeaders) {
      const value = response.headers.get(name);
      if (value !== null) outgoing.set(name, value);
    }
    for (const cookie of response.headers.getSetCookie())
      outgoing.append('set-cookie', cookie);
    if (request.method === 'HEAD' || !response.body) {
      cleanup();
      return new Response(null, { status: response.status, headers: outgoing });
    }
    const reader = limited(response.body, RESPONSE_LIMIT, () => {
      controller.abort();
    }).getReader();
    const stream = new ReadableStream<Uint8Array>({
      async pull(output) {
        try {
          const chunk = await reader.read();
          if (chunk.done) {
            cleanup();
            output.close();
          } else output.enqueue(chunk.value);
        } catch {
          cleanup();
          output.error(new Error('UPSTREAM_BODY_FAILED'));
        }
      },
      async cancel() {
        controller.abort();
        cleanup();
        await reader.cancel();
      },
    });
    return new Response(stream, { status: response.status, headers: outgoing });
  } catch {
    cleanup();
    return failure(
      state.requestTooLarge ? 413 : state.timedOut ? 504 : 502,
      state.requestTooLarge
        ? 'PAYLOAD_TOO_LARGE'
        : state.timedOut
          ? 'UPSTREAM_TIMEOUT'
          : 'UPSTREAM_UNAVAILABLE',
    );
  }
}
