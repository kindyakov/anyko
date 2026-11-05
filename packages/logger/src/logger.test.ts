import { expect, test } from 'bun:test';
import { createLogger } from './index';
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
