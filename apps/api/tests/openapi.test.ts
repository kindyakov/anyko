import { expect, test } from 'bun:test';

import { getWork as getWorkEndpoint } from '@anyko/contracts/works';
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
    paths: Record<
      string,
      Record<
        string,
        {
          summary: string;
          'x-error-codes': string[];
          parameters: { name: string; in: string }[];
        }
      >
    >;
  };
  expect(document.openapi).toBe('3.1.0');
  const getWork =
    document.paths['/api/v1/workspaces/{workspaceId}/works/{workId}']?.get;
  expect(getWork?.summary).toBe(getWorkEndpoint.summary);
  expect(getWork?.['x-error-codes']).toContain('NOT_FOUND');
  expect(getWork?.['x-error-codes']).toContain('FORBIDDEN');
  // Область описана параметром пути: web и клиенты видят её в документе, а не только в коде.
  expect(
    getWork?.parameters.some(
      (parameter) =>
        parameter.name === 'workspaceId' && parameter.in === 'path',
    ),
  ).toBe(true);
  expect(
    document.paths[
      '/api/v1/workspaces/{workspaceId}/works/{workId}/documents/{documentId}'
    ]?.delete?.['x-error-codes'],
  ).toContain('INVALID_WORK_INPUT');
  expect(Object.keys(document.paths)).toContain(
    '/api/v1/workspaces/{workspaceId}/works/{workId}/documents/{documentId}/source',
  );
  expect(Object.keys(document.paths)).toContain(
    '/api/v1/workspaces/{workspaceId}/recognitions/{documentId}/images/{index}',
  );
  expect(Object.keys(document.paths)).toContain('/api/v1/session');
  expect(Object.keys(document.paths)).toContain(
    '/api/v1/workspaces/{workspaceId}/settings/llm',
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
