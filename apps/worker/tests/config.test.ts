import { expect, test } from 'bun:test';

import { parseBackendEnv } from '../src/bootstrap/backend-config';
import { parseWorkerConfig } from '../src/bootstrap/config';

const backendEnv = {
  DATABASE_URL: 'postgresql://fixture:fixture@localhost/anyko_test',
  S3_ENDPOINT: 'http://localhost:19000',
  S3_BUCKET: 'fixture',
  S3_ACCESS_KEY: 'fixture',
  S3_SECRET_KEY: 'fixture',
  LLM_CONFIG_ENCRYPTION_KEY: 'a'.repeat(64),
  MINERU_BASE_URL: 'http://localhost:8000',
};
const worker = {
  redisUrl: 'redis://127.0.0.1:16379',
  shutdownTimeoutMs: 10000,
};

test('both mode flags default to empty and are parsed as explicit values', () => {
  const defaults = parseWorkerConfig({ REDIS_URL: 'redis://127.0.0.1:16379' });
  expect(defaults.DOCUMENTS_ENABLED).toBe('false');
  expect(defaults.WORKS_ENABLED).toBe('false');
  const enabled = parseWorkerConfig({
    REDIS_URL: 'redis://127.0.0.1:16379',
    DOCUMENTS_ENABLED: 'true',
    WORKS_ENABLED: 'true',
  });
  expect(enabled.DOCUMENTS_ENABLED).toBe('true');
  expect(enabled.WORKS_ENABLED).toBe('true');
});

test('full-mode backend environment validates every section and names missing fields', () => {
  expect(() => parseBackendEnv({}, worker)).toThrow('DATABASE_URL');
  expect(() =>
    parseBackendEnv(
      { ...backendEnv, LLM_CONFIG_ENCRYPTION_KEY: 'short' },
      worker,
    ),
  ).toThrow('LLM_CONFIG_ENCRYPTION_KEY');
  const parsed = parseBackendEnv(backendEnv, worker);
  expect(parsed.worker.mineru.timeoutMs).toBe(240000);
  expect(parsed.worker.redisUrl).toBe('redis://127.0.0.1:16379');
  expect(parsed.worker.analysisReviewMaxReads).toBeUndefined();
  expect(
    parseBackendEnv(
      { ...backendEnv, ANYKO_ANALYSIS_REVIEW_MAX_READS: '96' },
      worker,
    ).worker.analysisReviewMaxReads,
  ).toBe(96);
  expect(() =>
    parseBackendEnv(
      { ...backendEnv, ANYKO_ANALYSIS_REVIEW_MAX_READS: '0' },
      worker,
    ),
  ).toThrow('ANYKO_ANALYSIS_REVIEW_MAX_READS');
  expect(parsed.works.encryptionKey).toBe('a'.repeat(64));
});

test('ordinary and review steps accept independent read limits', () => {
  expect(
    parseBackendEnv(backendEnv, worker).worker.analysisMaxReads,
  ).toBeUndefined();
  const parsed = parseBackendEnv(
    {
      ...backendEnv,
      ANYKO_ANALYSIS_MAX_READS: '48',
      ANYKO_ANALYSIS_REVIEW_MAX_READS: '96',
    },
    worker,
  );
  expect(parsed.worker.analysisMaxReads).toBe(48);
  expect(parsed.worker.analysisReviewMaxReads).toBe(96);
  for (const value of ['0', '1.5', '257'])
    expect(() =>
      parseBackendEnv(
        {
          ...backendEnv,
          ANYKO_ANALYSIS_MAX_READS: value,
        },
        worker,
      ),
    ).toThrow('ANYKO_ANALYSIS_MAX_READS');
});

test('stepwise analysis defaults to false and requires a lowercase boolean', () => {
  expect(parseBackendEnv(backendEnv, worker).worker.stepwiseAnalysis).toBe(
    false,
  );
  for (const value of ['true', 'false']) {
    expect(
      parseBackendEnv({ ...backendEnv, ANYKO_ANALYSIS_STEPWISE: value }, worker)
        .worker.stepwiseAnalysis,
    ).toBe(value === 'true');
  }
  for (const value of ['TRUE', '1', '']) {
    const env = { ...backendEnv, ANYKO_ANALYSIS_STEPWISE: value };
    expect(() => parseBackendEnv(env, worker)).toThrow(
      'ANYKO_ANALYSIS_STEPWISE',
    );
    expect(() =>
      parseWorkerConfig({ ...env, REDIS_URL: worker.redisUrl }),
    ).toThrow('ANYKO_ANALYSIS_STEPWISE');
  }
});

test('model context minimum has a default and accepts only positive integers', () => {
  expect(parseBackendEnv(backendEnv, worker).worker.minModelContextTokens).toBe(
    131072,
  );
  expect(
    parseBackendEnv(
      { ...backendEnv, ANYKO_MIN_MODEL_CONTEXT_TOKENS: '262144' },
      worker,
    ).worker.minModelContextTokens,
  ).toBe(262144);
  for (const value of ['0', '-1', '1.5', '']) {
    const env = { ...backendEnv, ANYKO_MIN_MODEL_CONTEXT_TOKENS: value };
    expect(() => parseBackendEnv(env, worker)).toThrow(
      'ANYKO_MIN_MODEL_CONTEXT_TOKENS',
    );
    expect(() =>
      parseWorkerConfig({ ...env, REDIS_URL: worker.redisUrl }),
    ).toThrow('ANYKO_MIN_MODEL_CONTEXT_TOKENS');
  }
});

test.each([
  ['ANYKO_CHAT_MAX_MODEL_CALLS', 'chatMaxModelCalls', 64],
  ['ANYKO_RECONCILE_MAX_MODEL_CALLS', 'reconcileMaxModelCalls', 64],
  ['ANYKO_RECONCILE_MAX_READS', 'reconcileMaxReads', 256],
  ['ANYKO_VISION_MAX_OUTPUT_TOKENS', 'visionMaxOutputTokens', 16384],
] as const)('%s accepts only integers within its limits', (key, field, max) => {
  for (const value of [1, max]) {
    expect(
      parseBackendEnv({ ...backendEnv, [key]: String(value) }, worker).worker[
        field
      ],
    ).toBe(value);
  }
  for (const value of ['0', '1.5', String(max + 1), 'invalid']) {
    expect(() =>
      parseBackendEnv({ ...backendEnv, [key]: value }, worker),
    ).toThrow(key);
  }
});

test('worker requires Redis and accepts explicit process configuration', () => {
  expect(() => parseWorkerConfig({})).toThrow('REDIS_URL');
  expect(
    parseWorkerConfig({
      REDIS_URL: 'redis://127.0.0.1:6379',
      WORKER_PORT: '3102',
    }).WORKER_PORT,
  ).toBe(3102);
  expect(
    parseWorkerConfig({
      REDIS_URL: 'redis://127.0.0.1:6379',
      SHUTDOWN_TIMEOUT_MS: '300000',
    }).SHUTDOWN_TIMEOUT_MS,
  ).toBe(300000);
  expect(() =>
    parseWorkerConfig({
      REDIS_URL: 'redis://127.0.0.1:6379',
      SHUTDOWN_TIMEOUT_MS: '600001',
    }),
  ).toThrow('SHUTDOWN_TIMEOUT_MS');
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
  try {
    parseBackendEnv({ ...backendEnv, S3_SECRET_KEY: undefined }, worker);
    throw new Error('Expected rejection');
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    expect(error.message).toContain('S3_SECRET_KEY');
    expect(error.message).not.toContain('localhost');
  }
});

test('workload queue configuration defaults to all and rejects unknown and empty names', () => {
  const redis = { REDIS_URL: 'redis://127.0.0.1:16379' };
  expect(parseWorkerConfig(redis).WORKER_QUEUES).toBe(
    'ocr,llm,render,maintenance',
  );
  expect(
    parseWorkerConfig({ ...redis, WORKER_QUEUES: 'ocr' }).WORKER_QUEUES,
  ).toBe('ocr');
  for (const value of ['', 'ocr,unknown', 'ocr,'])
    expect(() => parseWorkerConfig({ ...redis, WORKER_QUEUES: value })).toThrow(
      'WORKER_QUEUES',
    );
});
