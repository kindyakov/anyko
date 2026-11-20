import { expect, test } from 'bun:test';

import {
  type AccessSession,
  type createAccess,
  scopeFor,
} from '@anyko/backend/access';
import { rightCatalog } from '@anyko/backend/scope';
import { createLogger } from '@anyko/logger';

import { createApp } from '../src/http/app';

import { describedEndpoints } from './support/endpoints';
import { stubHttpOptions } from './support/stub-http';

const origin = 'http://localhost:3000';
const foreignWorkspace = 'foreign-workspace';
// Участник только локальной области: адрес с чужой областью не должен пройти.
const member: AccessSession = {
  user: { id: 'member-1', name: 'Member', email: 'member@example.test' },
  memberships: [
    { workspace: { id: 'local', name: 'Local' }, rights: [...rightCatalog] },
  ],
};
const access: ReturnType<typeof createAccess> = {
  handle: () => Promise.resolve(new Response(null, { status: 404 })),
  session: (headers: Headers) =>
    Promise.resolve(headers.get('cookie') === 'session=ok' ? member : null),
  scope: scopeFor,
};

// Маршрут вне /api/v1 и /api/auth обошёл бы проверку области из адреса: такого маршрута нет.
test('no route lives under /api outside /api/v1 and /api/auth, so the scope check covers every API address', () => {
  const options = stubHttpOptions();
  const app = createApp({
    logger: createLogger({
      service: 'api',
      environment: 'test',
      release: 'isolation',
      level: 'fatal',
    }),
    environment: 'test',
    documentHttp: { ...options.documentHttp, access },
    workHttp: { ...options.workHttp, access },
  });
  const outside = app.routes
    .filter(
      (item) =>
        item.path.startsWith('/api/') &&
        !item.path.startsWith('/api/v1/') &&
        !item.path.startsWith('/api/auth/'),
    )
    .map((item) => `${item.method} ${item.path}`);
  expect(outside).toEqual([]);
});

// Адрес по описанию: область и прочие параметры подставляются без данных в хранилище.
function concretePath(path: string, workspaceId: string): string {
  return path.replaceAll(/:(\w+)/g, (_match, name: string) => {
    if (name === 'workspaceId') return workspaceId;
    return name === 'index' ? '0' : crypto.randomUUID();
  });
}

// Тест читает реестр описаний: новое описание с областью попадает в проверку автоматически.
// Вход не передаётся: plugin области выполняется до разбора тела и до поиска ресурса.
test('every endpoint with a workspace in the address answers 404 to a foreign workspace and 401 without a session', async () => {
  const options = stubHttpOptions();
  const app = createApp({
    logger: createLogger({
      service: 'api',
      environment: 'test',
      release: 'isolation',
      level: 'fatal',
    }),
    environment: 'test',
    documentHttp: { ...options.documentHttp, access },
    workHttp: { ...options.workHttp, access },
  });
  const scoped = describedEndpoints().filter((item) =>
    item.path.includes(':workspaceId'),
  );
  expect(scoped.length).toBeGreaterThan(0);
  const server = app.listen({ hostname: '127.0.0.1', port: 0 });
  try {
    const port = server.server?.port;
    if (port === undefined) throw new Error('No listener');
    const base = `http://127.0.0.1:${String(port)}/api/v1`;
    for (const item of scoped) {
      const label = `${item.method} ${item.path}`;
      const mutating = item.method !== 'GET';
      const url = `${base}${concretePath(item.path, foreignWorkspace)}`;
      const foreignResponse = await fetch(url, {
        method: item.method,
        headers: {
          cookie: 'session=ok',
          ...(mutating ? { origin } : {}),
        },
      });
      const foreign = (await foreignResponse.json()) as {
        error?: { code: string };
      };
      expect({ endpoint: label, status: foreignResponse.status }).toEqual({
        endpoint: label,
        status: 404,
      });
      expect({ endpoint: label, code: foreign.error?.code }).toEqual({
        endpoint: label,
        code: 'NOT_FOUND',
      });
      const anonymous = await fetch(
        `${base}${concretePath(item.path, foreignWorkspace)}`,
        {
          method: item.method,
          headers: mutating ? { origin } : {},
        },
      );
      expect({ endpoint: label, status: anonymous.status }).toEqual({
        endpoint: label,
        status: 401,
      });
    }
  } finally {
    await server.stop();
  }
});

// Контроль проверки: участие в адресе даёт область, поэтому 404 не появляется всюду.
test('the member workspace in the address passes the scope check', async () => {
  const options = stubHttpOptions();
  const app = createApp({
    logger: createLogger({
      service: 'api',
      environment: 'test',
      release: 'isolation',
      level: 'fatal',
    }),
    environment: 'test',
    documentHttp: { ...options.documentHttp, access },
    workHttp: { ...options.workHttp, access },
  });
  const scoped = describedEndpoints().filter((item) =>
    item.path.includes(':workspaceId'),
  );
  const server = app.listen({ hostname: '127.0.0.1', port: 0 });
  try {
    const port = server.server?.port;
    if (port === undefined) throw new Error('No listener');
    const base = `http://127.0.0.1:${String(port)}/api/v1`;
    for (const item of scoped) {
      const mutating = item.method !== 'GET';
      const response = await fetch(
        `${base}${concretePath(item.path, 'local')}`,
        {
          method: item.method,
          headers: {
            cookie: 'session=ok',
            ...(mutating ? { origin } : {}),
          },
        },
      );
      // Сценарии в этом тесте не подключены: важно только, что область не отвергнута.
      expect({
        endpoint: `${item.method} ${item.path}`,
        passed: response.status !== 404,
      }).toEqual({ endpoint: `${item.method} ${item.path}`, passed: true });
    }
  } finally {
    await server.stop();
  }
});
