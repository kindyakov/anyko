import { expect, test } from 'bun:test';

import { AppError } from '@anyko/backend/errors';
import type { IdempotencyApi } from '@anyko/backend/idempotency';
import type { WorkIntake } from '@anyko/backend/workflows';
import { createLogger } from '@anyko/logger';

import { createApp } from '../src/http/app';

import { memberAccess } from './support/member-access';
import { memoryIdempotency } from './support/memory-idempotency';
import { stubHttpOptions } from './support/stub-http';

const origin = 'http://localhost:3000';

type Analyze = WorkIntake['analyzeWork'];

// Приложение с подменённым сценарием анализа. Остальные сценарии не вызываются этими тестами.
function appWith(analyze: Analyze, idempotency?: IdempotencyApi) {
  const options = stubHttpOptions();
  const app = createApp({
    logger: createLogger({
      service: 'api',
      environment: 'test',
      release: 'idempotency-route',
      level: 'fatal',
    }),
    environment: 'test',
    documentHttp: { ...options.documentHttp, access: memberAccess },
    workHttp: {
      ...options.workHttp,
      access: memberAccess,
      idempotency: idempotency ?? options.workHttp.idempotency,
      intake: { ...options.workHttp.intake, analyzeWork: analyze },
    },
  });
  return app;
}

async function withServer(
  app: ReturnType<typeof createApp>,
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

function analyzeRequest(
  base: string,
  path: string,
  headers: Record<string, string> = {},
) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { cookie: 'session=ok', origin, ...headers },
  });
}

function createWorkRequest(base: string, body: unknown) {
  return fetch(`${base}/api/v1/workspaces/local/works`, {
    method: 'POST',
    headers: {
      cookie: 'session=ok',
      origin,
      'content-type': 'application/json',
      'idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });
}

test('an analyze request without Idempotency-Key is refused in v1', async () => {
  let calls = 0;
  const app = appWith(() => {
    calls++;
    return Promise.resolve();
  });
  await withServer(app, async (base) => {
    const workId = crypto.randomUUID();
    const response = await analyzeRequest(
      base,
      `/api/v1/workspaces/local/works/${workId}/analyze`,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: 'INVALID_IDEMPOTENCY_KEY' },
    });
  });
  expect(calls).toBe(0);
});

test('a malformed Idempotency-Key is refused with the key code', async () => {
  const app = appWith(() => Promise.resolve());
  await withServer(app, async (base) => {
    const response = await analyzeRequest(
      base,
      `/api/v1/workspaces/local/works/${crypto.randomUUID()}/analyze`,
      { 'idempotency-key': 'not-a-uuid' },
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: 'INVALID_IDEMPOTENCY_KEY' },
    });
  });
});

test('the same key and input run the command once and replay the stored response', async () => {
  let calls = 0;
  const app = appWith(() => {
    calls++;
    return Promise.resolve();
  });
  await withServer(app, async (base) => {
    const path = `/api/v1/workspaces/local/works/${crypto.randomUUID()}/analyze`;
    const key = crypto.randomUUID();
    const first = await analyzeRequest(base, path, { 'idempotency-key': key });
    const second = await analyzeRequest(base, path, {
      'idempotency-key': key,
    });
    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    expect(await second.json()).toEqual(await first.json());
    expect(second.headers.get('content-type')).toBe(
      first.headers.get('content-type'),
    );
    expect(second.headers.get('cache-control')).toBe('no-store');
  });
  expect(calls).toBe(1);
});

test('a replay for a deleted work answers NOT_FOUND with the current request ID', async () => {
  const app = appWith(() => Promise.resolve(), {
    run: () =>
      Promise.resolve({ kind: 'resource_unavailable', replayed: true }),
  });
  await withServer(app, async (base) => {
    const response = await createWorkRequest(base, {
      packageVersion: 'synthetic',
      title: 'Synthetic',
    });
    expect(response.status).toBe(404);
    const requestId = response.headers.get('x-request-id');
    expect(requestId).toBeTruthy();
    expect(await response.json()).toEqual({
      error: { code: 'NOT_FOUND', requestId },
    });
  });
});

test('analyze replay does not become unavailable when no created resource is recorded', async () => {
  let calls = 0;
  let hasResource = false;
  const idempotency = memoryIdempotency();
  const app = appWith(
    () => {
      calls++;
      return Promise.resolve();
    },
    {
      async run(command, execute) {
        const result = await idempotency.run(command, async () => {
          const reply = await execute();
          hasResource = reply.resource !== undefined;
          return reply;
        });
        // Simulate erasure of the reply only if the route recorded a created resource.
        return result.replayed && hasResource
          ? { kind: 'resource_unavailable', replayed: true }
          : result;
      },
    },
  );
  await withServer(app, async (base) => {
    const path = `/api/v1/workspaces/local/works/${crypto.randomUUID()}/analyze`;
    const headers = { 'idempotency-key': crypto.randomUUID() };
    expect((await analyzeRequest(base, path, headers)).status).toBe(202);
    const replay = await analyzeRequest(base, path, headers);
    expect(replay.status).toBe(202);
    expect(await replay.json()).toEqual({ status: 'queued' });
  });
  expect(calls).toBe(1);
});

test('the same key with another work is a conflict and runs nothing new', async () => {
  let calls = 0;
  const app = appWith(() => {
    calls++;
    return Promise.resolve();
  });
  await withServer(app, async (base) => {
    const key = crypto.randomUUID();
    const first = await analyzeRequest(
      base,
      `/api/v1/workspaces/local/works/${crypto.randomUUID()}/analyze`,
      { 'idempotency-key': key },
    );
    expect(first.status).toBe(202);
    const other = await analyzeRequest(
      base,
      `/api/v1/workspaces/local/works/${crypto.randomUUID()}/analyze`,
      { 'idempotency-key': key },
    );
    expect(other.status).toBe(409);
    expect(await other.json()).toMatchObject({
      error: { code: 'IDEMPOTENCY_CONFLICT' },
    });
  });
  expect(calls).toBe(1);
});

test('a request with the same key while the first runs is refused as in progress', async () => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let markStarted: () => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const app = appWith(async () => {
    markStarted();
    await gate;
  });
  await withServer(app, async (base) => {
    const path = `/api/v1/workspaces/local/works/${crypto.randomUUID()}/analyze`;
    const key = crypto.randomUUID();
    const running = analyzeRequest(base, path, { 'idempotency-key': key });
    // Второй запрос приходит, когда первый уже захватил ключ и выполняет сценарий.
    await started;
    const parallel = await analyzeRequest(base, path, {
      'idempotency-key': key,
    });
    expect(parallel.status).toBe(409);
    expect(await parallel.json()).toMatchObject({
      error: { code: 'IDEMPOTENCY_IN_PROGRESS' },
    });
    release();
    expect((await running).status).toBe(202);
  });
});

test('a failed command releases the key so the same key runs again', async () => {
  let calls = 0;
  const app = appWith(() => {
    calls++;
    if (calls === 1) throw new AppError('WORK_BUSY', 'conflict');
    return Promise.resolve();
  });
  await withServer(app, async (base) => {
    const path = `/api/v1/workspaces/local/works/${crypto.randomUUID()}/analyze`;
    const key = crypto.randomUUID();
    const failed = await analyzeRequest(base, path, {
      'idempotency-key': key,
    });
    expect(failed.status).toBe(409);
    expect(await failed.json()).toMatchObject({
      error: { code: 'WORK_BUSY' },
    });
    const retried = await analyzeRequest(base, path, {
      'idempotency-key': key,
    });
    expect(retried.status).toBe(202);
  });
  expect(calls).toBe(2);
});

test('work creation with an invalid body reports the input code before the command runs', async () => {
  const app = appWith(() => Promise.resolve());
  await withServer(app, async (base) => {
    const response = await createWorkRequest(base, { title: 1 });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: 'INVALID_WORK_INPUT' },
    });
  });
});
