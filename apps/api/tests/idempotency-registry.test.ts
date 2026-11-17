import { expect, test } from 'bun:test';

import { createLogger } from '@anyko/logger';

import { createApp } from '../src/http/app';

import { describedEndpoints } from './support/endpoints';
import { memberAccess } from './support/member-access';
import { stubHttpOptions } from './support/stub-http';

const origin = 'http://localhost:3000';

// Адрес по описанию: область — участника, прочие параметры — случайные значения.
// Тело не передаётся: заголовок Idempotency-Key проверяется раньше тела и до сценария.
function concretePath(path: string): string {
  return path.replaceAll(/:(\w+)/g, (_match, name: string) =>
    name === 'workspaceId'
      ? 'local'
      : name === 'index'
        ? '0'
        : crypto.randomUUID(),
  );
}

// Тест читает реестр описаний: новое описание режима key попадает в проверку автоматически.
test('every endpoint in the key mode answers 400 without Idempotency-Key', async () => {
  const options = stubHttpOptions();
  const app = createApp({
    logger: createLogger({
      service: 'api',
      environment: 'test',
      release: 'idempotency-registry',
      level: 'fatal',
    }),
    environment: 'test',
    documentHttp: { ...options.documentHttp, access: memberAccess },
    workHttp: { ...options.workHttp, access: memberAccess },
  });
  const keyed = describedEndpoints().filter(
    (item) => item.idempotency === 'key',
  );
  expect(keyed.length).toBeGreaterThan(0);
  const server = app.listen({ hostname: '127.0.0.1', port: 0 });
  try {
    const port = server.server?.port;
    if (port === undefined) throw new Error('No listener');
    const base = `http://127.0.0.1:${String(port)}/api/v1`;
    for (const item of keyed) {
      const label = `${item.method} ${item.path}`;
      const response = await fetch(`${base}${concretePath(item.path)}`, {
        method: item.method,
        headers: { cookie: 'session=ok', origin },
      });
      const body = (await response.json()) as { error?: { code: string } };
      expect({ endpoint: label, status: response.status }).toEqual({
        endpoint: label,
        status: 400,
      });
      expect({ endpoint: label, code: body.error?.code }).toEqual({
        endpoint: label,
        code: 'INVALID_IDEMPOTENCY_KEY',
      });
    }
  } finally {
    await server.stop();
  }
});
