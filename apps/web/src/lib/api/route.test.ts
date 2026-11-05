import { expect, mock, test } from 'bun:test';

// The framework's server-only marker is supplied by Next in production.
await mock.module('server-only', () => ({}));

test('actual Next DELETE handler relays an authenticated deletion request', async () => {
  const previousOrigin = process.env.API_ORIGIN;
  const previousAppOrigin = process.env.APP_ORIGIN;
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(request) {
      expect(request.method).toBe('DELETE');
      expect(new URL(request.url).pathname).toBe(
        '/api/documents/synthetic-document',
      );
      expect(request.headers.get('cookie')).toBe('session=synthetic-fixture');
      return Response.json({ status: 'deleting' }, { status: 202 });
    },
  });
  try {
    process.env.APP_ORIGIN = 'http://localhost:3000';
    process.env.API_ORIGIN = `http://127.0.0.1:${String(server.port)}`;
    const { DELETE } = await import('../../app/api/[...path]/route');
    const response = await DELETE(
      new Request('http://localhost:3000/api/documents/synthetic-document', {
        method: 'DELETE',
        headers: {
          origin: 'http://localhost:3000',
          cookie: 'session=synthetic-fixture',
        },
      }),
      {
        params: Promise.resolve({ path: ['documents', 'synthetic-document'] }),
      },
    );
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ status: 'deleting' });
  } finally {
    if (previousAppOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousAppOrigin;
    if (previousOrigin === undefined) delete process.env.API_ORIGIN;
    else process.env.API_ORIGIN = previousOrigin;
    await server.stop(true);
  }
});
