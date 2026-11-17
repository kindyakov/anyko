import { expect, test } from 'bun:test';

import * as session from '@anyko/contracts/session';
import { createLogger } from '@anyko/logger';

import { createApp } from '../src/http/app';
import { legacyPathOf } from '../src/http/legacy/paths';

import { contractModules, describedEndpoints } from './support/endpoints';
import { stubHttpOptions } from './support/stub-http';

test('every contract subpath is listed in the registry test', async () => {
  const manifest = (await Bun.file(
    new URL('../../../packages/contracts/package.json', import.meta.url),
  ).json()) as { exports: Record<string, string> };
  const subpaths = Object.keys(manifest.exports)
    .filter((key) => key !== '.')
    .map((key) => key.slice(2))
    .sort();
  expect(subpaths).toEqual(Object.keys(contractModules).sort());
});

test('every contract endpoint is registered exactly once under /api/v1 and nothing else is', () => {
  const { documentHttp, workHttp } = stubHttpOptions();
  const app = createApp({
    logger: createLogger({
      service: 'api',
      environment: 'test',
      release: 'registry',
      level: 'fatal',
    }),
    environment: 'test',
    documentHttp,
    workHttp,
  });
  const expected = describedEndpoints()
    .map((item) => `${item.method} /api/v1${item.path}`)
    .sort();
  const registered = app.routes
    .filter(
      (item) =>
        item.path.startsWith('/api/v1/') &&
        item.path !== '/api/v1/openapi.json',
    )
    .map((item) => `${item.method} ${item.path}`)
    .sort();
  expect(registered).toEqual(expected);
});

test('the temporary unversioned layer registers the same endpoints, except the session and the new work documents', () => {
  const { documentHttp, workHttp } = stubHttpOptions();
  const app = createApp({
    logger: createLogger({
      service: 'api',
      environment: 'test',
      release: 'registry',
      level: 'fatal',
    }),
    environment: 'test',
    documentHttp,
    workHttp,
  });
  const legacy = app.routes
    .filter(
      (item) =>
        item.path.startsWith('/api/') &&
        !item.path.startsWith('/api/v1/') &&
        !item.path.startsWith('/api/auth/'),
    )
    .map((item) => `${item.method} ${item.path}`)
    .sort();
  // Прежняя сессия описана в apps/api (legacy/session.ts), contracts её не регистрирует.
  // Снимается вместе с web #11.
  const expected = describedEndpoints()
    .filter((item) => item !== session.getSession)
    .flatMap((item) => {
      const path = legacyPathOf(item);
      return path === null ? [] : [`${item.method} /api${path}`];
    })
    .concat(['GET /api/session'])
    .sort();
  expect(legacy).toEqual(expected);
});
