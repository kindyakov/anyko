import { expect, test } from 'bun:test';

import { parseE2eConfig } from './config';

const valid = {
  E2E_DATABASE_URL: 'postgresql://localhost/anyko_e2e',
  E2E_REDIS_URL: 'redis://localhost:6379',
  E2E_OWNER_EMAIL: 'owner@example.test',
  E2E_OWNER_PASSWORD: 'owner-password',
  E2E_MEMBER_EMAIL: 'member@example.test',
  E2E_MEMBER_PASSWORD: 'member-password',
  E2E_OUTSIDER_EMAIL: 'outsider@example.test',
  E2E_OUTSIDER_PASSWORD: 'outsider-password',
  APP_ORIGIN: 'http://127.0.0.1:3030',
  AUTH_BASE_URL: 'http://127.0.0.1:3031',
  AUTH_SECRET: 's'.repeat(32),
  LLM_CONFIG_ENCRYPTION_KEY: 'a'.repeat(64),
};

test('preparation only accepts a dedicated public-schema E2E database', () => {
  expect(parseE2eConfig(valid).E2E_DATABASE_URL).toBe(valid.E2E_DATABASE_URL);
  for (const url of [
    'postgresql://localhost/anyko',
    'postgresql://localhost/anyko_e2e?schema=other',
    'postgresql://localhost/anyko_e2e_backup',
  ])
    expect(() => parseE2eConfig({ ...valid, E2E_DATABASE_URL: url })).toThrow();
});

test('seed accounts must be distinct regardless of email case', () => {
  expect(() =>
    parseE2eConfig({ ...valid, E2E_MEMBER_EMAIL: 'OWNER@example.test' }),
  ).toThrow();
});
