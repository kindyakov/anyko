import { expect, test } from 'bun:test';

import { DocumentError } from '@anyko/backend/documents';
import { createLogger } from '@anyko/logger';

import { createApp } from '../src/http/app';

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

test('real HTTP carries request context, safe errors and readiness', async () => {
  const lines: string[] = [];
  let ready = true;
  const logger = createLogger(
    { service: 'api', environment: 'test', release: 'test', level: 'info' },
    {
      write: (line) => {
        lines.push(line);
      },
    },
  );
  const app = createApp({ logger, ready: () => ready })
    .get('/failure', () => {
      throw new Error('private-fixture');
    })
    .listen({ hostname: '127.0.0.1', port: 0 });
  try {
    const port = app.server?.port;
    if (port === undefined) throw new Error('No listener');
    const origin = `http://127.0.0.1:${String(port)}`;
    const response = await fetch(`${origin}/failure?secret=private-fixture`);
    expect(response.status).toBe(500);
    const id = response.headers.get('x-request-id');
    expect(id).toBeTruthy();
    expect(await response.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', requestId: id },
    });
    const missing = await fetch(`${origin}/missing?secret=private-fixture`);
    expect(missing.status).toBe(404);
    ready = false;
    expect((await fetch(`${origin}/health/ready`)).status).toBe(503);
    await Bun.sleep(10);
    expect(lines.join('')).toContain('http_failed');
    expect(lines.join('')).toContain(id ?? 'impossible-id');
    expect(lines.join('')).not.toContain('private-fixture');
  } finally {
    await app.stop();
  }
});

test('invalid content and unsupported document formats produce actionable client errors', async () => {
  const app = createApp()
    .get('/invalid-document', () => {
      throw new DocumentError('INVALID_DOCUMENT');
    })
    .get('/unsupported-format', () => {
      throw new DocumentError('UNSUPPORTED_DOCUMENT_FORMAT');
    })
    .listen({ hostname: '127.0.0.1', port: 0 });
  try {
    const port = app.server?.port;
    if (port === undefined) throw new Error('No listener');
    for (const [path, code] of [
      ['/invalid-document', 'INVALID_DOCUMENT'],
      ['/unsupported-format', 'UNSUPPORTED_DOCUMENT_FORMAT'],
    ] as const) {
      const response = await fetch(`http://127.0.0.1:${String(port)}${path}`);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: { code, requestId: response.headers.get('x-request-id') },
      });
    }
  } finally {
    await app.stop();
  }
});
