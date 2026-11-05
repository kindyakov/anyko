import { expect, test } from 'bun:test';
import { parseWorkerConfig } from './config';
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
