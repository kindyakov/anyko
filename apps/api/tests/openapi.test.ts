import { expect, test } from 'bun:test';

import { createLogger } from '@anyko/logger';

import { createApp } from '../src/http/app';

import { stubHttpOptions } from './support/stub-http';

const logger = createLogger({
  service: 'api',
  environment: 'test',
  release: 'openapi',
  level: 'fatal',
});

test('OpenAPI document is built from the endpoint descriptions outside production', async () => {
  const { documentHttp, workHttp } = stubHttpOptions();
  const app = createApp({
    logger,
    environment: 'development',
    documentHttp,
    workHttp,
  });
  const response = await app.handle(
    new Request('http://localhost/api/v1/openapi.json'),
  );
  expect(response.status).toBe(200);
  const document = (await response.json()) as {
    openapi: string;
    paths: Record<string, Record<string, { 'x-error-codes': string[] }>>;
  };
  expect(document.openapi).toBe('3.1.0');
  expect(
    document.paths['/api/v1/works/{workId}']?.get?.['x-error-codes'],
  ).toContain('NOT_FOUND');
  expect(
    document.paths['/api/v1/works/{workId}/documents/{documentId}']?.delete?.[
      'x-error-codes'
    ],
  ).toContain('INVALID_WORK_INPUT');
  expect(Object.keys(document.paths)).toContain(
    '/api/v1/documents/{documentId}/images/{index}',
  );
});

test('production serves no OpenAPI document', async () => {
  const { documentHttp, workHttp } = stubHttpOptions();
  const app = createApp({
    logger,
    environment: 'production',
    documentHttp,
    workHttp,
  });
  const response = await app.handle(
    new Request('http://localhost/api/v1/openapi.json'),
  );
  expect(response.status).toBe(404);
});
