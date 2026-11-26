import { expect, test } from 'bun:test';

import { DocumentError } from '@anyko/backend/documents';
import { AppError } from '@anyko/backend/errors';
import { createLogger, DiagnosticError, inOperation } from '@anyko/logger';

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
    .get('/failure', () =>
      inOperation('catalog.listPackages', () => {
        throw new DiagnosticError(
          {
            code: 'DB_COLUMN_MISSING',
            message: 'В схеме БД отсутствует ожидаемая колонка.',
            operation: 'templates.readPlaceholders',
            causeCode: 'P2022',
          },
          { cause: new Error('private-fixture') },
        );
      }),
    )
    .get('/conflict', () => {
      throw new AppError('REVISION_CONFLICT', 'conflict');
    })
    .listen({ hostname: '127.0.0.1', port: 0 });
  try {
    const port = app.server?.port;
    if (port === undefined) throw new Error('No listener');
    const origin = `http://127.0.0.1:${String(port)}`;
    const correlationId = crypto.randomUUID();
    const response = await fetch(`${origin}/failure?secret=private-fixture`, {
      headers: { 'x-correlation-id': correlationId },
    });
    expect(response.status).toBe(500);
    const id = response.headers.get('x-request-id');
    expect(id).toBeTruthy();
    expect(response.headers.get('x-correlation-id')).toBe(correlationId);
    expect(await response.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', requestId: id },
    });
    const missing = await fetch(`${origin}/missing?secret=private-fixture`);
    expect(missing.status).toBe(404);
    const conflict = await fetch(`${origin}/conflict`, {
      headers: { 'x-correlation-id': 'private-fixture' },
    });
    const conflictId = conflict.headers.get('x-request-id');
    expect(conflict.status).toBe(409);
    expect(conflict.headers.get('x-correlation-id')).toBe(conflictId);
    expect(await conflict.json()).toEqual({
      error: { code: 'REVISION_CONFLICT', requestId: conflictId },
    });
    ready = false;
    expect((await fetch(`${origin}/health/ready`)).status).toBe(503);
    await Bun.sleep(10);
    const events = lines.map(
      (line) => JSON.parse(line) as Record<string, unknown>,
    );
    const failures = events.filter(
      (event) => event.requestId === id && event.level === 50,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      event: 'http_failed',
      correlationId,
      route: '/failure',
      statusCode: 500,
      errorCode: 'DB_COLUMN_MISSING',
      failure: {
        message: 'В схеме БД отсутствует ожидаемая колонка.',
        causeCode: 'P2022',
        operation: 'templates.readPlaceholders',
        operations: [
          'api.handleRequest',
          'catalog.listPackages',
          'templates.readPlaceholders',
        ],
      },
    });
    const conflicts = events.filter((event) => event.requestId === conflictId);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      event: 'http_completed',
      level: 30,
      statusCode: 409,
      errorCode: 'REVISION_CONFLICT',
    });
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

test('recognition listing validates filters and forwards them with the page', async () => {
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
            return Promise.resolve({
              items: [],
              page: 1,
              pageSize: input.pageSize,
              total: 0,
            });
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
    page: '3',
    pageSize: '12',
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
      page: 3,
      pageSize: 12,
    },
  ]);
  for (const query of [
    'page=0',
    'pageSize=49',
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

test('catalog accepts 60 deletion confirmations in one request and reports a conflict per file', async () => {
  const { documentHttp } = stubHttpOptions();
  const blocked = crypto.randomUUID();
  const ids = [
    ...Array.from({ length: 30 }, () => crypto.randomUUID()),
    blocked,
    ...Array.from({ length: 29 }, () => crypto.randomUUID()),
  ];
  const impact = 'a'.repeat(64);
  const received: string[] = [];
  const app = createApp({
    environment: 'test',
    documentHttp: {
      ...documentHttp,
      access: memberAccess,
      documents: {
        ...documentHttp.documents,
        commands: {
          ...documentHttp.documents.commands,
          async remove(scope, id, token) {
            expect(String(scope.workspaceId)).toBe('local');
            expect(token).toBe(impact);
            received.push(id);
            await Promise.resolve();
            if (id === blocked) throw new DocumentError('REVISION_CONFLICT');
          },
        },
        queries: {
          ...documentHttp.documents.queries,
          deletionImpact: () =>
            Promise.resolve({ token: impact, canDelete: true, works: [] }),
          deletions: (scope, documentIds) => {
            expect(String(scope.workspaceId)).toBe('local');
            return Promise.resolve(
              documentIds.map((documentId) => ({
                documentId,
                status: 'deleted' as const,
              })),
            );
          },
        },
      },
    },
  });
  const documents = ids.map((documentId) => ({ documentId, impact }));
  const address =
    'http://localhost/api/v1/workspaces/local/recognition-deletions';
  const read = (suffix: string, documentIds: string[]) =>
    app.handle(
      new Request(
        `${address}${suffix}?documentIds=${encodeURIComponent(documentIds.join(','))}`,
        { headers: { cookie: 'session=ok' } },
      ),
    );
  const submit = (selection: typeof documents) =>
    app.handle(
      new Request(address, {
        method: 'POST',
        headers: {
          cookie: 'session=ok',
          origin: documentHttp.origin,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ documents: selection }),
      }),
    );

  const preview = await read('/deletion-impact', ids);
  expect(preview.status).toBe(200);
  expect(await preview.json()).toEqual({
    impacts: ids.map((documentId) => ({
      documentId,
      token: impact,
      canDelete: true,
      works: [],
    })),
  });
  const response = await submit(documents);
  expect(response.status).toBe(202);
  expect(received).toEqual(ids);
  expect(await response.json()).toEqual({
    results: ids.map((documentId) =>
      documentId === blocked
        ? { documentId, status: 'rejected', code: 'REVISION_CONFLICT' }
        : { documentId, status: 'deleting' },
    ),
  });
  const accepted = ids.filter((id) => id !== blocked);
  const status = await read('', accepted);
  expect(status.status).toBe(200);
  expect(await status.json()).toEqual({
    results: accepted.map((documentId) => ({ documentId, status: 'deleted' })),
  });
  const duplicate = { documentId: blocked, impact };
  expect((await submit([duplicate, duplicate])).status).toBe(400);
  expect(received).toEqual(ids);
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

test('the work source PATCH requires a positive OCR revision and forwards the scoped target', async () => {
  const options = stubHttpOptions();
  const calls: unknown[] = [];
  const workId = crypto.randomUUID();
  const documentId = crypto.randomUUID();
  const app = createApp({
    environment: 'test',
    workHttp: {
      ...options.workHttp,
      access: memberAccess,
      intake: {
        ...options.workHttp.intake,
        updateRecognition(scope, input) {
          calls.push({ workspaceId: scope.workspaceId, ...input });
          return Promise.resolve();
        },
      },
    },
  });
  const request = (ocrRevision: number) =>
    app.handle(
      new Request(
        `http://localhost/api/v1/workspaces/local/works/${workId}/documents/${documentId}`,
        {
          method: 'PATCH',
          headers: {
            origin: 'http://localhost:3000',
            cookie: 'session=ok',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ ocrRevision }),
        },
      ),
    );
  expect((await request(0)).status).toBe(400);
  const updated = await request(2);
  expect(updated.status).toBe(200);
  expect(await updated.json()).toEqual({ status: 'updated' });
  expect(calls).toEqual([
    { workspaceId: 'local', workId, documentId, ocrRevision: 2 },
  ]);
});
