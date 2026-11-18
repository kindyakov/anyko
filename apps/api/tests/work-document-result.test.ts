import { expect, test } from 'bun:test';

import type { WorkViews } from '@anyko/backend/workflows';
import { WorkError } from '@anyko/backend/works';
import { createLogger } from '@anyko/logger';

import { createApp } from '../src/http/app';

import { memberAccess } from './support/member-access';
import { stubHttpOptions } from './support/stub-http';

const workId = crypto.randomUUID();
const documentId = crypto.randomUUID();
const resultPath = `/api/v1/workspaces/local/works/${workId}/documents/${documentId}/result`;

// Сценарий подменён: тест проверяет адрес, область, форму ответа и коды, а не распознавание.
function appWith(result: WorkViews['result']) {
  const options = stubHttpOptions();
  return createApp({
    logger: createLogger({
      service: 'api',
      environment: 'test',
      release: 'work-document-result',
      level: 'fatal',
    }),
    environment: 'test',
    documentHttp: { ...options.documentHttp, access: memberAccess },
    workHttp: {
      ...options.workHttp,
      access: memberAccess,
      views: { ...options.workHttp.views, result },
    },
  });
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

test('the result of a work document answers 200 with image links through the work address', async () => {
  const calls: { workspaceId: string; workId: string; documentId: string }[] =
    [];
  const app = appWith((scope, work, document) => {
    calls.push({
      workspaceId: scope.workspaceId,
      workId: work,
      documentId: document,
    });
    return Promise.resolve({
      markdown: '# Результат',
      processorVersion: 'fixture',
      revision: 1,
      images: [{ path: 'images/a.png', index: 0 }],
    });
  });
  await withServer(app, async (base) => {
    const response = await fetch(`${base}${resultPath}`, {
      headers: { cookie: 'session=ok' },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      markdown: '# Результат',
      processorVersion: 'fixture',
      images: [
        {
          path: 'images/a.png',
          url: `/api/v1/workspaces/local/works/${workId}/documents/${documentId}/images/0`,
        },
      ],
    });
  });
  expect(calls).toEqual([{ workspaceId: 'local', workId, documentId }]);
});

test('a document that is not attached to the work answers 404 NOT_FOUND', async () => {
  const app = appWith(() => Promise.reject(new WorkError('NOT_FOUND')));
  await withServer(app, async (base) => {
    const response = await fetch(`${base}${resultPath}`, {
      headers: { cookie: 'session=ok' },
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
  });
});

test('a document whose recognition has no result yet answers 409 NOT_READY', async () => {
  const app = appWith(() => Promise.reject(new WorkError('NOT_READY')));
  await withServer(app, async (base) => {
    const response = await fetch(`${base}${resultPath}`, {
      headers: { cookie: 'session=ok' },
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: 'NOT_READY' },
    });
  });
});
