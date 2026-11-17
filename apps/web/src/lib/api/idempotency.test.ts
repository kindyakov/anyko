import { expect, test } from 'bun:test';

import { ApiError } from '@/lib/api/errors';
import { createIdempotencyKey } from '@/lib/api/idempotency';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test('take gives the same key until the action settles, and a new one after success', () => {
  const action = createIdempotencyKey();
  const first = action.take();
  expect(first).toMatch(uuid);
  expect(action.take()).toBe(first);
  action.settle();
  const next = action.take();
  expect(next).toMatch(uuid);
  expect(next).not.toBe(first);
});

test('a definite answer from the server starts a new action, even when it is a refusal', () => {
  for (const error of [
    new ApiError('IDEMPOTENCY_CONFLICT', 409, 'r1'),
    new ApiError('INVALID_WORK_INPUT', 400, 'r2'),
    new ApiError('INTERNAL_ERROR', 500, 'r3'),
    new ApiError('FORBIDDEN', 403, 'r4'),
  ]) {
    const action = createIdempotencyKey();
    const first = action.take();
    action.settle(error);
    expect(action.take()).not.toBe(first);
  }
});

test('an unknown outcome keeps the key for the repeated action', () => {
  for (const error of [
    new ApiError('NETWORK_ERROR', undefined, undefined),
    new ApiError('REQUEST_TIMEOUT', undefined, undefined),
    new ApiError('REQUEST_ABORTED', undefined, undefined),
    new ApiError('HTTP_ERROR', undefined, undefined),
  ]) {
    const action = createIdempotencyKey();
    const first = action.take();
    action.settle(error);
    expect(action.take()).toBe(first);
  }
});
