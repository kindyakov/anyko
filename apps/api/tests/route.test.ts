import { expect, test } from 'bun:test';

import { Elysia } from 'elysia';
import { z } from 'zod';

import type { createAccess } from '@anyko/backend/access';
import { AppError } from '@anyko/backend/errors';
import {
  endpoint,
  fileDownload,
  json,
  multipart,
} from '@anyko/contracts/common';
import { createLogger } from '@anyko/logger';

import { errorHandling } from '../src/http/plugins/errors';
import { noStore } from '../src/http/plugins/no-store';
import { originGuard } from '../src/http/plugins/origin';
import { requestContext } from '../src/http/plugins/request-context';
import { sessionGuard } from '../src/http/plugins/session';
import { createRoute, type Route } from '../src/http/route';

const origin = 'http://localhost:3000';
const session = {
  user: {
    id: crypto.randomUUID(),
    name: 'Fixture',
    email: 'fixture@example.test',
  },
  workspace: { id: 'local', name: 'Fixture' },
};
// Заглушка доступа: сессия есть только у запроса с cookie session=ok.
const access = {
  handle: () => Promise.resolve(new Response(null, { status: 404 })),
  canManage: () => Promise.resolve(false),
  session: (headers: Headers) =>
    Promise.resolve(headers.get('cookie') === 'session=ok' ? session : null),
} satisfies ReturnType<typeof createAccess>;
const authed = { cookie: 'session=ok' };

const item = endpoint({
  method: 'GET',
  path: '/items/:itemId',
  params: z.object({ itemId: z.uuid() }),
  response: json(z.object({ ok: z.literal(true) })),
  status: 200,
  errors: ['NOT_FOUND', 'INVALID_WORK_INPUT'],
  invalid: 'INVALID_WORK_INPUT',
});
// Ответ с условием: заведомо нарушенная схема даёт 500, а не ответ без проверки.
const broken = endpoint({
  method: 'GET',
  path: '/broken',
  response: json(z.object({ ok: z.boolean().refine((value) => value) })),
  status: 200,
  errors: [],
});
const file = endpoint({
  method: 'GET',
  path: '/files/:itemId',
  params: z.object({ itemId: z.uuid() }),
  response: fileDownload(),
  status: 200,
  errors: ['NOT_FOUND', 'INVALID_WORK_INPUT'],
  invalid: 'INVALID_WORK_INPUT',
});
const upload = endpoint({
  method: 'POST',
  path: '/uploads',
  body: multipart({ file: z.file().max(4) }),
  response: json(z.object({ ok: z.literal(true) })),
  status: 201,
  errors: ['INVALID_DOCUMENT'],
  invalid: 'INVALID_DOCUMENT',
  idempotent: false,
});
const guarded = endpoint({
  method: 'POST',
  path: '/guarded',
  body: json(z.object({ value: z.string() })),
  response: json(z.object({ ok: z.literal(true) })),
  status: 200,
  errors: ['FORBIDDEN', 'INVALID_WORK_INPUT'],
  invalid: 'INVALID_WORK_INPUT',
  idempotent: false,
});

function build(
  strictErrors: boolean,
  mount: (route: Route, api: Elysia) => void,
) {
  const lines: string[] = [];
  const logger = createLogger(
    { service: 'api', environment: 'test', release: 'test', level: 'info' },
    {
      write: (line) => {
        lines.push(line);
      },
    },
  );
  const route = createRoute({
    logger,
    strictErrors,
    endpoints: new Set(),
    prefix: '/api/v1',
  });
  const api = new Elysia();
  noStore(api);
  sessionGuard(api, access);
  originGuard(api, origin);
  mount(route, api);
  const app = new Elysia();
  requestContext(app, logger);
  errorHandling(app, logger);
  app.use(api);
  return { app, lines };
}

async function withServer(
  app: Elysia,
  run: (base: string) => Promise<void>,
): Promise<void> {
  const server = app.listen({ hostname: '127.0.0.1', port: 0 });
  try {
    const port = server.server?.port;
    if (port === undefined) throw new Error('No listener');
    await run(`http://127.0.0.1:${String(port)}`);
  } finally {
    await server.stop();
  }
}

test('an error code missing from the description is an internal error in tests and is logged', async () => {
  const { app, lines } = build(true, (route, api) =>
    route(api, item, () => {
      throw new AppError('FORBIDDEN', 'forbidden');
    }),
  );
  await withServer(app, async (base) => {
    const response = await fetch(
      `${base}/api/v1/items/${crypto.randomUUID()}`,
      { headers: authed },
    );
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
  const logged = lines.join('');
  expect(logged).toContain('http_undeclared_error_code');
  expect(logged).toContain('"errorCode":"FORBIDDEN"');
});

test('outside tests the same undeclared code keeps its response and is only logged', async () => {
  const { app, lines } = build(false, (route, api) =>
    route(api, item, () => {
      throw new AppError('FORBIDDEN', 'forbidden');
    }),
  );
  await withServer(app, async (base) => {
    const response = await fetch(
      `${base}/api/v1/items/${crypto.randomUUID()}`,
      { headers: authed },
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: {
        code: 'FORBIDDEN',
        requestId: response.headers.get('x-request-id'),
      },
    });
  });
  expect(lines.join('')).toContain('http_undeclared_error_code');
});

test('invalid input answers with the code the description declares', async () => {
  const { app } = build(true, (route, api) =>
    route(api, item, () => ({ ok: true as const })),
  );
  await withServer(app, async (base) => {
    const response = await fetch(`${base}/api/v1/items/not-a-uuid`, {
      headers: authed,
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_WORK_INPUT');
  });
});

test('a missing session answers 401 before input is read and forbids caching', async () => {
  const { app } = build(true, (route, api) =>
    route(api, item, () => ({ ok: true as const })),
  );
  await withServer(app, async (base) => {
    const response = await fetch(`${base}/api/v1/items/not-a-uuid`);
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});

test('a response that breaks its schema is an internal error', async () => {
  const { app, lines } = build(true, (route, api) =>
    route(api, broken, () => ({ ok: false })),
  );
  await withServer(app, async (base) => {
    const response = await fetch(`${base}/api/v1/broken`, {
      headers: authed,
    });
    expect(response.status).toBe(500);
  });
  expect(lines.join('')).toContain('http_response_invalid');
});

test('file responses carry the handler headers and the security defaults', async () => {
  const { app } = build(true, (route, api) =>
    route(api, file, () => ({
      bytes: new TextEncoder().encode('hello'),
      headers: {
        'content-type': 'text/plain',
        'content-disposition': 'attachment; filename="a.txt"',
      },
    })),
  );
  await withServer(app, async (base) => {
    const response = await fetch(
      `${base}/api/v1/files/${crypto.randomUUID()}`,
      { headers: authed },
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('hello');
    expect(response.headers.get('content-type')).toBe('text/plain');
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="a.txt"',
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });
});

test('multipart fields are checked against the description and the origin comes first', async () => {
  const { app } = build(true, (route, api) =>
    route(api, upload, () => ({ ok: true as const })),
  );
  await withServer(app, async (base) => {
    const form = (size: number) => {
      const body = new FormData();
      body.set(
        'file',
        new File([new Uint8Array(size)], 'a.bin', {
          type: 'application/octet-stream',
        }),
      );
      return body;
    };
    const accepted = await fetch(`${base}/api/v1/uploads`, {
      method: 'POST',
      headers: { ...authed, origin },
      body: form(4),
    });
    expect(accepted.status).toBe(201);
    const tooLarge = await fetch(`${base}/api/v1/uploads`, {
      method: 'POST',
      headers: { ...authed, origin },
      body: form(5),
    });
    expect(tooLarge.status).toBe(400);
    const body = (await tooLarge.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_DOCUMENT');
    const foreign = await fetch(`${base}/api/v1/uploads`, {
      method: 'POST',
      headers: authed,
      body: form(4),
    });
    expect(foreign.status).toBe(403);
  });
});

test('the permission guard runs before the body is read', async () => {
  const { app } = build(true, (route, api) =>
    route(api, guarded, () => ({ ok: true as const }), {
      guard: () => {
        throw new AppError('FORBIDDEN', 'forbidden');
      },
    }),
  );
  await withServer(app, async (base) => {
    const response = await fetch(`${base}/api/v1/guarded`, {
      method: 'POST',
      headers: { ...authed, origin, 'content-type': 'application/json' },
      body: 'not json',
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('FORBIDDEN');
  });
});
