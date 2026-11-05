import { expect, test } from 'bun:test';
import {
  documentResultSchema,
  documentsResponseSchema,
} from '@anyko/contracts';
import { ApiError, requestApi, type HttpFetch } from './client';
import { proxyApiRequest } from './proxy';

test('proxy uses configured public origin despite Next internal localhost URL and forwards SSE cursor', async () => {
  let calls = 0;
  const upstream: HttpFetch = (_url, init) => {
    calls++;
    const headers = new Headers(init?.headers);
    expect(headers.get('origin')).toBe('http://127.0.0.1:3000');
    expect(headers.get('last-event-id')).toBe('42');
    return Promise.resolve(
      new Response('id: 43\ndata: {}\n\n', {
        headers: {
          'content-type': 'text/event-stream',
          'x-accel-buffering': 'no',
        },
      }),
    );
  };
  const allowed = await proxyApiRequest(
    new Request('http://localhost:3000/api/works', {
      method: 'POST',
      headers: { origin: 'http://127.0.0.1:3000', 'last-event-id': '42' },
    }),
    ['works'],
    'http://127.0.0.1:3001',
    1000,
    upstream,
    'http://127.0.0.1:3000',
  );
  expect(allowed.status).toBe(200);
  expect(await allowed.text()).toContain('id: 43');
  expect(allowed.headers.get('x-accel-buffering')).toBe('no');
  const denied = await proxyApiRequest(
    new Request('http://foreign.test/api/works', {
      method: 'POST',
      headers: {
        origin: 'http://foreign.test',
        host: 'foreign.test',
        'x-forwarded-host': '127.0.0.1:3000',
      },
    }),
    ['works'],
    'http://127.0.0.1:3001',
    1000,
    upstream,
    'http://127.0.0.1:3000',
  );
  expect(denied.status).toBe(403);
  expect(calls).toBe(1);
});

test('client validates unknown data and retains request ID without leaking upstream bodies', async () => {
  const fake: HttpFetch = () =>
    Promise.resolve(
      Response.json(
        { private: 'private-fixture' },
        { headers: { 'x-request-id': 'r1' } },
      ),
    );
  try {
    await requestApi('/documents', documentsResponseSchema, { fetch: fake });
    throw new Error('Expected rejection');
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    if (!(error instanceof ApiError)) throw error;
    expect(error.code).toBe('INVALID_RESPONSE');
    expect(error.requestId).toBe('r1');
    expect(error.message).not.toContain('private-fixture');
  }
});
test('client sends multipart bodies intact and does not invent a boundary', async () => {
  const body = new FormData();
  body.set('file', new File(['%PDF-fixture'], 'test.pdf'));
  const fake: HttpFetch = (_url, init) => {
    expect(init?.body).toBe(body);
    expect(new Headers(init?.headers).get('content-type')).toBeNull();
    expect(init?.credentials).toBe('same-origin');
    return Promise.resolve(
      Response.json({ markdown: 'text', processorVersion: '4.1' }),
    );
  };
  expect(
    await requestApi('/documents', documentResultSchema, {
      method: 'POST',
      body,
      fetch: fake,
    }),
  ).toEqual({ markdown: 'text', processorVersion: '4.1', images: [] });
});
test('client deadline aborts fetch and reports timeout', async () => {
  const fake: HttpFetch = (_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener(
        'abort',
        () => {
          reject(new Error('private-fixture'));
        },
        { once: true },
      );
    });
  expect(
    await requestApi('/documents', documentsResponseSchema, {
      timeoutMs: 10,
      fetch: fake,
    }).catch((failure: unknown) => failure),
  ).toMatchObject({ code: 'REQUEST_TIMEOUT' });
});
test('client rejects destination/path injection before calling fetch', async () => {
  let calls = 0;
  const fake: HttpFetch = () => {
    calls++;
    return Promise.resolve(new Response());
  };
  for (const path of ['//remote', '/../documents', 'https://remote', '/%2e%2e'])
    expect(
      await requestApi(path, documentsResponseSchema, { fetch: fake }).catch(
        (failure: unknown) => failure,
      ),
    ).toMatchObject({ code: 'INVALID_API_PATH' });
  expect(calls).toBe(0);
});
test('proxy preserves fixed API path, session cookie and separate response cookies', async () => {
  const fake: HttpFetch = (url, init) => {
    expect(
      url instanceof Request
        ? url.url
        : typeof url === 'string'
          ? url
          : url.href,
    ).toBe('http://127.0.0.1:3001/api/auth/sign-in/email');
    expect(new Headers(init?.headers).get('cookie')).toBe('session=fixture');
    expect(new Headers(init?.headers).get('idempotency-key')).toBe(
      'operation-1',
    );
    expect(new Headers(init?.headers).get('x-forwarded-host')).toBeNull();
    const headers = new Headers({
      'x-request-id': 'r2',
      'content-type': 'application/json',
    });
    headers.append('set-cookie', 'a=1; HttpOnly');
    headers.append('set-cookie', 'b=2; HttpOnly');
    return Promise.resolve(new Response('{}', { headers }));
  };
  const request = new Request('http://localhost:3000/api/auth/sign-in/email', {
    method: 'POST',
    headers: {
      cookie: 'session=fixture',
      origin: 'http://localhost:3000',
      'x-forwarded-host': 'hostile',
      'idempotency-key': 'operation-1',
    },
    body: '{}',
  });
  const response = await proxyApiRequest(
    request,
    ['auth', 'sign-in', 'email'],
    'http://127.0.0.1:3001',
    1000,
    fake,
  );
  expect(await response.text()).toBe('{}');
  expect(response.headers.get('x-request-id')).toBe('r2');
  expect(response.headers.getSetCookie()).toHaveLength(2);
});
test('proxy denies cross-origin mutations, oversized bodies and path traversal before upstream', async () => {
  let calls = 0;
  const fake: HttpFetch = () => {
    calls++;
    return Promise.resolve(new Response('{}'));
  };
  expect(
    (
      await proxyApiRequest(
        new Request('http://localhost:3000/api/documents', {
          method: 'POST',
          headers: { origin: 'https://hostile.test' },
        }),
        ['documents'],
        'http://127.0.0.1:3001',
        1000,
        fake,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await proxyApiRequest(
        new Request('http://localhost:3000/api/documents', {
          method: 'POST',
          headers: { 'content-length': String(22 * 1024 * 1024) },
        }),
        ['documents'],
        'http://127.0.0.1:3001',
        1000,
        fake,
      )
    ).status,
  ).toBe(413);
  expect(
    (
      await proxyApiRequest(
        new Request('http://localhost:3000/api/documents'),
        ['..', 'documents'],
        'http://127.0.0.1:3001',
        1000,
        fake,
      )
    ).status,
  ).toBe(400);
  expect(calls).toBe(0);
});
test('proxy bounds chunked uploads without trusting content-length', async () => {
  const fake: HttpFetch = async (_url, init) => {
    await new Response(init?.body).arrayBuffer();
    return Response.json({});
  };
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(21 * 1024 * 1024 + 1));
      controller.close();
    },
  });
  const response = await proxyApiRequest(
    new Request('http://localhost:3000/api/documents', {
      method: 'POST',
      body,
    }),
    ['documents'],
    'http://127.0.0.1:3001',
    1000,
    fake,
  );
  expect(response.status).toBe(413);
});
test('proxy keeps deadline active through response streaming', async () => {
  const fake: HttpFetch = (_url, init) =>
    Promise.resolve(
      new Response(
        new ReadableStream({
          start(controller) {
            init?.signal?.addEventListener(
              'abort',
              () => {
                controller.error(new Error('private-fixture'));
              },
              { once: true },
            );
          },
        }),
      ),
    );
  const response = await proxyApiRequest(
    new Request('http://localhost:3000/api/documents'),
    ['documents'],
    'http://127.0.0.1:3001',
    10,
    fake,
  );
  const failure = await response.text().catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(Error);
  if (failure instanceof Error)
    expect(failure.message).toBe('UPSTREAM_BODY_FAILED');
});
test('proxy does not follow upstream redirects', async () => {
  const fake: HttpFetch = () =>
    Promise.resolve(
      new Response(null, {
        status: 302,
        headers: { location: 'https://hostile.test' },
      }),
    );
  const response = await proxyApiRequest(
    new Request('http://localhost:3000/api/documents'),
    ['documents'],
    'http://127.0.0.1:3001',
    1000,
    fake,
  );
  expect(response.status).toBe(502);
  expect(response.headers.get('location')).toBeNull();
});
