import { expect, test } from 'bun:test';

import { agentSessionContextSchema } from '../schemas';

test('persisted context rejects incompatible prompt and shape versions', () => {
  expect(
    agentSessionContextSchema.safeParse({ version: 2, summary: 'old' }).success,
  ).toBe(false);
});
