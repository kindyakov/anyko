import { expect, test } from 'bun:test';

import {
  createLogger,
  diagnoseFailure,
  DiagnosticError,
  inOperation,
} from './index';
test('structured context excludes arbitrary request and error properties', () => {
  const lines: string[] = [];
  const logger = createLogger(
    {
      service: 'api',
      environment: 'test',
      release: 'test-release',
      level: 'info',
    },
    {
      write: (line) => {
        lines.push(line);
      },
    },
  );
  const input = {
    event: 'request_failed',
    requestId: 'r1',
    errorCode: 'INTERNAL_ERROR',
    error: new Error('sensitive fixture'),
    authorization: 'sensitive fixture',
  };
  logger.error(input);
  expect(lines).toHaveLength(1);
  const line = lines[0] ?? '';
  expect(JSON.parse(line)).toMatchObject({
    schemaVersion: 1,
    service: 'api',
    release: 'test-release',
    event: 'request_failed',
    requestId: 'r1',
  });
  expect(line).not.toContain('sensitive fixture');
});

test('diagnosis keeps typed causes and source frames while excluding multiline exception messages', async () => {
  let thrown: unknown;
  try {
    await inOperation('works.open', () => {
      throw new DiagnosticError(
        {
          code: 'WORK_READ_FAILED',
          message: 'Чтение работы завершилось сбоем.',
          operation: 'works.read',
        },
        {
          cause: new DiagnosticError(
            {
              code: 'DB_COLUMN_MISSING',
              message: 'Отсутствует колонка.',
              operation: 'templates.readPlaceholders',
              causeCode: 'P2022',
            },
            {
              cause: new Error(
                `private-fixture\n    at ${process.cwd()}/packages/private-fixture.ts:42:1`,
              ),
            },
          ),
        },
      );
    });
  } catch (error) {
    thrown = error;
  }
  const diagnostic = diagnoseFailure(thrown, {
    code: 'HTTP_FAILED',
    message: 'Сбой HTTP.',
    operation: 'api.handleRequest',
  });
  expect(diagnostic).toMatchObject({
    code: 'DB_COLUMN_MISSING',
    message: 'Отсутствует колонка.',
    operation: 'templates.readPlaceholders',
    causeCode: 'P2022',
    operations: [
      'api.handleRequest',
      'works.open',
      'works.read',
      'templates.readPlaceholders',
    ],
    chain: [{ code: 'WORK_READ_FAILED' }, { code: 'DB_COLUMN_MISSING' }],
  });
  expect(diagnostic.source?.[0]).toMatch(
    /^packages\/logger\/src\/logger\.test\.ts:\d+$/u,
  );
  expect(JSON.stringify(diagnostic)).not.toContain('private-fixture');
});

test('an error created by another bundle keeps its diagnostic across the logging boundary', async () => {
  const copyPath = './diagnostics.ts?other-bundle';
  const other = (await import(copyPath)) as typeof import('./diagnostics');
  expect(other.DiagnosticError).not.toBe(DiagnosticError);
  const diagnostic = diagnoseFailure(
    new other.DiagnosticError({
      code: 'SESSION_API_REJECTED',
      message: 'API вернул ошибку при проверке сессии.',
      operation: 'web.readSession',
    }),
    {
      code: 'WEB_REQUEST_FAILED',
      message: 'Запрос завершился сбоем.',
      operation: 'web.handleRequest',
    },
  );
  expect(diagnostic).toMatchObject({
    code: 'SESSION_API_REJECTED',
    message: 'API вернул ошибку при проверке сессии.',
    operations: ['web.handleRequest', 'web.readSession'],
  });
});
