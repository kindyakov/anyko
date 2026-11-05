import { expect, test } from 'bun:test';
import { parseWorkerConfig } from './config';

test('document consumer is explicit and validates all of its dependencies', () => {
  const disabled = parseWorkerConfig({ REDIS_URL: 'redis://127.0.0.1:16379' });
  expect(disabled.documents).toBeNull();
  expect(() =>
    parseWorkerConfig({
      REDIS_URL: 'redis://127.0.0.1:16379',
      DOCUMENTS_ENABLED: 'true',
    }),
  ).toThrow('DATABASE_URL');
  const enabled = parseWorkerConfig({
    REDIS_URL: 'redis://127.0.0.1:16379',
    DOCUMENTS_ENABLED: 'true',
    DATABASE_URL: 'postgresql://fixture:fixture@localhost/anyko_test',
    S3_ENDPOINT: 'http://localhost:19000',
    S3_BUCKET: 'fixture',
    S3_ACCESS_KEY: 'fixture',
    S3_SECRET_KEY: 'fixture',
    MINERU_BASE_URL: 'http://localhost:8000',
  });
  expect(enabled.documents?.MINERU_TIMEOUT_MS).toBe(240000);
});
test('worker requires Redis and accepts explicit process configuration', () => {
  expect(() => parseWorkerConfig({})).toThrow('REDIS_URL');
  expect(
    parseWorkerConfig({
      REDIS_URL: 'redis://127.0.0.1:6379',
      WORKER_PORT: '3102',
    }).WORKER_PORT,
  ).toBe(3102);
});
test('configuration rejects invalid values without exposing secret inputs', () => {
  const secret = 'not-a-url-sensitive-value';
  try {
    parseWorkerConfig({ REDIS_URL: secret, WORKER_CONCURRENCY: '0' });
    throw new Error('Expected rejection');
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    expect(error.message).toContain('REDIS_URL');
    expect(error.message).toContain('WORKER_CONCURRENCY');
    expect(error.message).not.toContain(secret);
  }
});
