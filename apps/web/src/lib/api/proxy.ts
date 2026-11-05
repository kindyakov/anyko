import { httpErrorSchema } from '@anyko/contracts';

const requestHeaders = ['accept', 'accept-language', 'content-type', 'cookie', 'authorization', 'origin', 'range', 'if-none-match'];
const responseHeaders = ['content-type', 'content-disposition', 'content-range', 'accept-ranges', 'etag', 'vary', 'x-request-id'];

/** A fixed-origin transport adapter; it never accepts an upstream from the browser. */
export async function proxyApiRequest(request: Request, path: readonly string[], origin: string, timeoutMs = 10000): Promise<Response> {
  const base = new URL(origin);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
    throw new Error('INVALID_API_ORIGIN');
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new Error('INVALID_PROXY_TIMEOUT');
  const requestId = crypto.randomUUID();
  function failure(status: number, code: 'INVALID_REQUEST' | 'UPSTREAM_TIMEOUT' | 'UPSTREAM_UNAVAILABLE') {
    const body = httpErrorSchema.parse({ error: { code, requestId } });
    return Response.json(body, { status, headers: { 'x-request-id': requestId, 'cache-control': 'no-store' } });
  }
  if (path.length === 0 || path.some(segment => segment === '.' || segment === '..' || /[\\/\u0000-\u001f]/.test(segment))) {
    return failure(400, 'INVALID_REQUEST');
  }
  const target = new URL(`/${path.map(encodeURIComponent).join('/')}`, base);
  target.search = new URL(request.url).search;
  const headers = new Headers();
  for (const name of requestHeaders) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (request.signal.aborted) controller.abort();
  request.signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetch(target, {
      method: request.method, headers, signal: controller.signal, redirect: 'manual', cache: 'no-store',
      ...(request.method === 'GET' || request.method === 'HEAD' ? {} : { body: request.body }),
    });
    // Bound the entire body transfer too; no upstream cookies/headers are trusted implicitly.
    const body = request.method === 'HEAD' ? null : await response.arrayBuffer();
    const outgoing = new Headers({ 'cache-control': 'no-store' });
    for (const name of responseHeaders) {
      const value = response.headers.get(name);
      if (value !== null) outgoing.set(name, value);
    }
    for (const cookie of response.headers.getSetCookie()) outgoing.append('set-cookie', cookie);
    return new Response(body, { status: response.status, headers: outgoing });
  } catch {
    return failure(timedOut ? 504 : 502, timedOut ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE');
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', abort);
  }
}
