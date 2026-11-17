import { expect, test } from 'bun:test';

import * as catalog from '@anyko/contracts/catalog';
import { type Endpoint, isEndpoint } from '@anyko/contracts/common';
import * as common from '@anyko/contracts/common';
import * as connections from '@anyko/contracts/connections';
import * as documents from '@anyko/contracts/documents';
import * as session from '@anyko/contracts/session';
import * as works from '@anyko/contracts/works';
import { createLogger } from '@anyko/logger';

import { createApp } from '../src/http/app';

import { stubHttpOptions } from './support/stub-http';

// Каждый subpath contracts перечислен здесь; тест ниже ловит subpath, забытый в этом списке.
const contractModules = {
  catalog,
  common,
  connections,
  documents,
  session,
  works,
};

function describedEndpoints(): Endpoint[] {
  return Object.values(contractModules).flatMap((module) =>
    Object.values(module).filter(isEndpoint),
  );
}

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
  // Временный префикс без версии повторяет тот же набор; снимается вместе с web #11.
  const legacy = app.routes
    .filter(
      (item) =>
        item.path.startsWith('/api/') &&
        !item.path.startsWith('/api/v1/') &&
        !item.path.startsWith('/api/auth/'),
    )
    .map((item) => `${item.method} ${item.path}`)
    .sort();
  expect(legacy).toEqual(
    expected.map((line) => line.replace('/api/v1', '/api')).sort(),
  );
});
