import { afterEach, expect, test } from 'bun:test';

import { saveLlmSettings } from '@anyko/contracts/connections';
import { getSession, type Session } from '@anyko/contracts/session';
import {
  analyzeWork,
  generateWork,
  getWork,
  getWorkDocumentImage,
  getWorkDocumentSource,
  listWorks,
  removeWorkDocument,
  streamWorkEvents,
  uploadWorkDocument,
} from '@anyko/contracts/works';

import { callApi, endpointUrl, newIdempotencyKey } from '@/lib/api/call';
import { ApiError } from '@/lib/api/errors';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const workspace = 'workspace-1';
const workId = '0b6f4e3a-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
const documentId = '1d7f5e4b-2d3e-4f60-9b0c-1d2e3f4a5b6c';
const session: Session = {
  user: { id: 'user-1', name: 'Test', email: 'user@example.test' },
  memberships: [
    { workspace: { id: workspace, name: 'Workspace' }, rights: ['works.read'] },
  ],
};

type Sent = {
  url: string;
  method: string;
  headers: Headers;
  body: BodyInit | null | undefined;
};

// Сеть подменяется на уровне fetch: проверяем запрос, который уходит, и ответ, который приходит.
function answer(respond: () => Response) {
  const sent: Sent[] = [];
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    sent.push({
      url:
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      body: init?.body,
    });
    return Promise.resolve(respond());
  }) as typeof fetch;
  return sent;
}

const json =
  (body: unknown, status = 200) =>
  () =>
    Response.json(body, { status });

// Причина отказа как значение. Ожидание через `rejects` в типах Bun не возвращает промис,
// поэтому отказ забирается через then; успешный вызов здесь — ошибка теста.
async function failureOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('Ожидался отказ, вызов завершился успехом');
    },
    (error: unknown) => error,
  );
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('a JSON call without parameters goes to the versioned path with no body and no key', async () => {
  const sent = answer(json(session));
  expect(await callApi(getSession)).toEqual(session);
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ url: '/api/v1/session', method: 'GET' });
  expect(sent[0]?.headers.get('content-type')).toBeNull();
  expect(sent[0]?.headers.get('idempotency-key')).toBeNull();
});

test('path parameters fill the template, and a missing one is refused before the request', async () => {
  const sent = answer(
    json({ items: [], page: 1, pageSize: 24, total: 0, deletions: [] }),
  );
  await callApi(listWorks, { params: { workspaceId: workspace } });
  expect(sent[0]?.url).toBe('/api/v1/workspaces/workspace-1/works');

  // @ts-expect-error -- без параметров пути вызов не типизируется
  const noOptions = callApi(listWorks);
  expect(String(await failureOf(noOptions))).toContain(
    'Не задан параметр пути «workspaceId»',
  );
  // @ts-expect-error -- пустой объект параметров не покрывает путь
  const emptyParams = callApi(listWorks, { params: {} });
  expect(String(await failureOf(emptyParams))).toContain(
    'Не задан параметр пути «workspaceId»',
  );
  expect(sent).toHaveLength(1);
});

test('a parameter that needs escaping is refused by the path check, never sent', async () => {
  const sent = answer(
    json({ items: [], page: 1, pageSize: 24, total: 0, deletions: [] }),
  );
  expect(
    await failureOf(callApi(listWorks, { params: { workspaceId: 'a/../b' } })),
  ).toMatchObject({ code: 'INVALID_API_PATH' });
  expect(sent).toHaveLength(0);
});

test('query values are sent as given, undefined filters are skipped', async () => {
  const sent = answer(
    json({ items: [], page: 1, pageSize: 24, total: 0, deletions: [] }),
  );
  await callApi(listWorks, {
    params: { workspaceId: workspace },
    query: { page: 2, pageSize: 12, q: undefined },
  });
  await callApi(listWorks, {
    params: { workspaceId: workspace },
    query: { q: 'Case 100%', status: 'draft' },
  });
  await callApi(listWorks, { params: { workspaceId: workspace }, query: {} });
  expect(sent.map((request) => request.url)).toEqual([
    '/api/v1/workspaces/workspace-1/works?page=2&pageSize=12',
    '/api/v1/workspaces/workspace-1/works?q=Case+100%25&status=draft',
    '/api/v1/workspaces/workspace-1/works',
  ]);
});

test('a JSON body is serialized with its content type, and the key goes into the header', async () => {
  const sent = answer(json({ status: 'queued' }, 202));
  const key = newIdempotencyKey();
  expect(
    await callApi(generateWork, {
      params: { workspaceId: workspace, workId },
      body: { revision: 3 },
      idempotencyKey: key,
    }),
  ).toEqual({ status: 'queued' });
  expect(sent[0]).toMatchObject({
    url: `/api/v1/workspaces/workspace-1/works/${workId}/generate`,
    method: 'POST',
    body: '{"revision":3}',
  });
  expect(sent[0]?.headers.get('content-type')).toBe('application/json');
  expect(sent[0]?.headers.get('idempotency-key')).toBe(key);
});

test('a natural-idempotency command sends no key header', async () => {
  const sent = answer(json({ status: 'saved' }));
  await callApi(saveLlmSettings, {
    params: { workspaceId: workspace },
    body: {
      baseURL: 'https://models.example.test/v1',
      visionModel: 'vision',
      extractionModel: 'extraction',
    },
  });
  expect(sent[0]?.headers.get('idempotency-key')).toBeNull();
  expect(sent[0]?.headers.get('content-type')).toBe('application/json');
});

test('a multipart body is sent as form data without a hand-written content type', async () => {
  const sent = answer(
    json(
      {
        document: {
          id: 'doc-1',
          filename: 'passport.pdf',
          status: 'queued',
          createdAt: '2026-11-01T10:00:00.000Z',
        },
      },
      202,
    ),
  );
  const file = new File(['%PDF-fixture'], 'passport.pdf', {
    type: 'application/pdf',
  });
  await callApi(uploadWorkDocument, {
    params: { workspaceId: workspace, workId },
    body: { file },
    idempotencyKey: newIdempotencyKey(),
  });
  const body = sent[0]?.body;
  expect(body).toBeInstanceOf(FormData);
  if (!(body instanceof FormData)) throw new Error('Expected form data');
  expect(body.get('file')).toBeInstanceOf(File);
  expect(sent[0]?.headers.get('content-type')).toBeNull();
});

test('a response that does not match the endpoint schema is an invalid response', async () => {
  answer(json({ user: { id: 'user-1' } }));
  expect(await failureOf(callApi(getSession))).toMatchObject({
    code: 'INVALID_RESPONSE',
  });
});

test('an error envelope keeps its code and field problems in the ApiError', async () => {
  // Номер запроса приходит заголовком x-request-id: транспорт читает его оттуда.
  answer(() =>
    Response.json(
      {
        error: {
          code: 'INVALID_WORK_INPUT',
          requestId: 'request-1',
          fields: [{ path: ['title'], code: 'too_long' }],
        },
      },
      { status: 400, headers: { 'x-request-id': 'request-1' } },
    ),
  );
  const failure = await failureOf(
    callApi(removeWorkDocument, {
      params: { workspaceId: workspace, workId, documentId },
    }),
  );
  if (!(failure instanceof ApiError)) throw new Error('Expected ApiError');
  expect(failure.code).toBe('INVALID_WORK_INPUT');
  expect(failure.status).toBe(400);
  expect(failure.requestId).toBe('request-1');
  expect(failure.fields).toEqual([{ path: ['title'], code: 'too_long' }]);
});

test('a key-mode command without a valid key is refused before the request', async () => {
  const sent = answer(json({ status: 'queued' }, 202));
  // @ts-expect-error -- режим key без ключа не типизируется; рантайм проверяет то же самое
  const withoutKey = callApi(analyzeWork, {
    params: { workspaceId: workspace, workId },
  });
  expect(String(await failureOf(withoutKey))).toContain('Idempotency-Key');
  expect(
    String(
      await failureOf(
        callApi(analyzeWork, {
          params: { workspaceId: workspace, workId },
          idempotencyKey: 'not-a-uuid',
        }),
      ),
    ),
  ).toContain('Idempotency-Key');
  expect(sent).toHaveLength(0);
});

test('a deadline comes from the transport and reports a timeout', async () => {
  globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener(
        'abort',
        () => {
          reject(new Error('aborted'));
        },
        { once: true },
      );
    })) as typeof fetch;
  expect(await failureOf(callApi(getSession, { timeoutMs: 10 }))).toMatchObject(
    { code: 'REQUEST_TIMEOUT' },
  );
});

test('endpointUrl builds the same versioned path for events and files, with encoded parameters', () => {
  expect(
    endpointUrl(streamWorkEvents, {
      params: { workspaceId: workspace, workId },
      query: { after: '42' },
    }),
  ).toBe(`/api/v1/workspaces/workspace-1/works/${workId}/events?after=42`);
  expect(
    endpointUrl(getWorkDocumentImage, {
      params: { workspaceId: workspace, workId, documentId, index: 'a b/c' },
    }),
  ).toBe(
    `/api/v1/workspaces/workspace-1/works/${workId}/documents/${documentId}/images/a%20b%2Fc`,
  );
  expect(endpointUrl(getSession)).toBe('/api/v1/session');
  expect(
    endpointUrl(getWorkDocumentSource, {
      params: { workspaceId: workspace, workId, documentId },
    }),
  ).toBe(
    `/api/v1/workspaces/workspace-1/works/${workId}/documents/${documentId}/source`,
  );
});

test('newIdempotencyKey gives a fresh UUID for every action', () => {
  const first = newIdempotencyKey();
  const second = newIdempotencyKey();
  expect(first).toMatch(uuidPattern);
  expect(second).toMatch(uuidPattern);
  expect(first).not.toBe(second);
});

// Проверка типов: функция не вызывается, её строки проверяет `tsc` (`bun run typecheck`).
// Каждая строка с @ts-expect-error должна давать ошибку, иначе tsc сообщит о лишней директиве.
test('the call types reject calls that the contract does not allow', () => {
  const typeChecks = (): void => {
    // @ts-expect-error -- параметр пути задан строкой, а не числом
    void callApi(getWork, { params: { workspaceId: 1, workId } });
    // @ts-expect-error -- файл не разбирается как JSON, для него endpointUrl
    void callApi(getWorkDocumentSource, {
      params: { workspaceId: workspace, workId, documentId },
    });
    // @ts-expect-error -- у endpoint с параметрами пути нет адреса без workId
    endpointUrl(getWork, { params: { workspaceId: workspace } });
    void callApi(analyzeWork, {
      params: { workspaceId: workspace, workId },
      idempotencyKey: newIdempotencyKey(),
    });
    void callApi(getSession);
  };
  expect(typeof typeChecks).toBe('function');
});
