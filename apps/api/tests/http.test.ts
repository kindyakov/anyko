import { expect, test } from 'bun:test';

import { DocumentError } from '@anyko/backend/documents';
import { AppError } from '@anyko/backend/errors';
import { createLogger } from '@anyko/logger';

import { createApp } from '../src/http/app';

import { memberAccess } from './support/member-access';
import { stubHttpOptions } from './support/stub-http';

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

test('recognition listing validates filters and forwards them with the cursor', async () => {
  const { documentHttp } = stubHttpOptions();
  const inputs: unknown[] = [];
  const app = createApp({
    environment: 'test',
    documentHttp: {
      ...documentHttp,
      access: memberAccess,
      documents: {
        ...documentHttp.documents,
        queries: {
          ...documentHttp.documents.queries,
          list(scope, input) {
            inputs.push({ workspaceId: scope.workspaceId, ...input });
            return Promise.resolve({ items: [], nextCursor: null });
          },
          pendingDeletions: () => Promise.resolve([]),
        },
      },
    },
  });
  const request = (query: string) =>
    app.handle(
      new Request(
        'http://localhost/api/v1/workspaces/local/recognitions?' + query,
        {
          headers: { cookie: 'session=ok' },
        },
      ),
    );
  const valid = new URLSearchParams({
    checksum: 'a'.repeat(64),
    q: '  Счёт_100%  ',
    formats: 'pdf,heif',
    after: 'cursor',
    limit: '20',
  });
  const listing = await request(valid.toString());
  expect(listing.status).toBe(200);
  expect(await listing.json()).toMatchObject({ checksum: 'a'.repeat(64) });
  expect(inputs).toEqual([
    {
      workspaceId: 'local',
      checksum: 'a'.repeat(64),
      q: 'Счёт_100%',
      formats: ['pdf', 'heif'],
      after: 'cursor',
      limit: 20,
    },
  ]);
  for (const query of [
    'formats=pdf,exe',
    'formats=pdf,',
    'q=%00',
    'checksum=wrong',
  ]) {
    const response = await request(query);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: 'INVALID_DOCUMENT' },
    });
  }
  expect(inputs).toHaveLength(1);
});

test('every error kind maps to one HTTP status and keeps the declared code', async () => {
  const kinds = [
    ['invalid', 400],
    ['unauthenticated', 401],
    ['forbidden', 403],
    ['not_found', 404],
    ['conflict', 409],
    ['precondition', 409],
    ['unavailable', 503],
  ] as const;
  const server = createApp()
    .get('/kind/:kind', ({ params }) => {
      const kind = kinds.find(([name]) => name === params.kind)?.[0];
      if (!kind) throw new Error('unknown fixture kind');
      throw new AppError(`FIXTURE_${kind.toUpperCase()}`, kind);
    })
    .listen({ hostname: '127.0.0.1', port: 0 });
  try {
    const port = server.server?.port;
    if (port === undefined) throw new Error('No listener');
    for (const [kind, status] of kinds) {
      const response = await fetch(
        `http://127.0.0.1:${String(port)}/kind/${kind}`,
      );
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({
        error: {
          code: `FIXTURE_${kind.toUpperCase()}`,
          requestId: response.headers.get('x-request-id'),
        },
      });
    }
  } finally {
    await server.stop();
  }
});

// Сценарий подменён на границе модуля. Проверяем преобразование query и HTTP-форму страницы.
test('work listing sends only numbered pages with deletion status', async () => {
  const options = stubHttpOptions();
  const pending = [{ id: crypto.randomUUID(), status: 'deleting' as const }];
  const app = createApp({
    environment: 'test',
    workHttp: {
      ...options.workHttp,
      access: memberAccess,
      works: {
        ...options.workHttp.works,
        queries: {
          ...options.workHttp.works.queries,
          list: (_scope, { page, pageSize }) =>
            Promise.resolve({ items: [], page, pageSize, total: 77 }),
        },
      },
      deletion: {
        ...options.workHttp.deletion,
        pending: () => Promise.resolve(pending),
      },
    },
  });
  const address = 'http://localhost/api/v1/workspaces/local/works';
  const get = (query: string) =>
    app.handle(
      new Request(address + query, { headers: { cookie: 'session=ok' } }),
    );

  for (const [query, page, pageSize] of [
    ['', 1, 24],
    ['?page=2&pageSize=12', 2, 12],
  ] as const) {
    const response = await get(query);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [],
      page,
      pageSize,
      total: 77,
      deletions: pending,
    });
  }
  for (const query of ['?pageSize=25', '?after=cursor']) {
    const response = await get(query);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: 'INVALID_WORK_INPUT' },
    });
  }
});
