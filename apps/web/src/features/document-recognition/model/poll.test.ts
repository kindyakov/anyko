import { expect, test } from 'bun:test';

import { isRecognizing } from './poll';

test('recognition is active only in the queued and running statuses', () => {
  expect(isRecognizing({ status: 'queued' })).toBe(true);
  expect(isRecognizing({ status: 'running' })).toBe(true);
  expect(isRecognizing({ status: 'succeeded' })).toBe(false);
  expect(isRecognizing({ status: 'failed' })).toBe(false);
});
