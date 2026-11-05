import { expect, test } from 'bun:test';
import { createApp } from './app';

test('health responds over HTTP', async () => {
  const app = createApp().listen({ hostname: '127.0.0.1', port: 0 });
  try {
    const server = app.server;
    if (!server || server.port === undefined)
      throw new Error('API did not start');
    const response = await fetch(
      `http://127.0.0.1:${String(server.port)}/health`,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  } finally {
    await app.stop();
  }
});
