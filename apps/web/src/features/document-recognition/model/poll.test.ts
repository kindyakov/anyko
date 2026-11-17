import { expect, test } from 'bun:test';

import { recognitionPollInterval, recognitionPollMs } from './poll';

const document = (status: 'queued' | 'running' | 'succeeded' | 'failed') => ({
  status,
});

test('the list polls while a document is queued or running', () => {
  expect(
    recognitionPollInterval({
      documents: [document('succeeded'), document('running')],
      deletions: [],
    }),
  ).toBe(recognitionPollMs);
  expect(
    recognitionPollInterval({
      documents: [document('queued')],
      deletions: [],
    }),
  ).toBe(recognitionPollMs);
});

test('the list polls while a deletion is not finished, even without processing documents', () => {
  expect(
    recognitionPollInterval({
      documents: [document('succeeded')],
      deletions: [{ id: 'd1', createdAt: '2026-11-01T10:00:00.000Z' }],
    }),
  ).toBe(recognitionPollMs);
});

test('the list stops polling when nothing is processing or deleting, and before the first answer', () => {
  expect(recognitionPollInterval(undefined)).toBe(false);
  expect(
    recognitionPollInterval({
      documents: [document('succeeded'), document('failed')],
      deletions: [],
    }),
  ).toBe(false);
});
