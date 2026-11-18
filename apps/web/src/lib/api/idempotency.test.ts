import { expect, test } from 'bun:test';

import { ApiError } from '@/lib/api/errors';
import {
  createIdempotencyKey,
  withIdempotencyKey,
} from '@/lib/api/idempotency';

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

test('a mutation keeps the key after lost response and releases it after a server refusal or success', async () => {
  const action = createIdempotencyKey();
  const received: string[] = [];
  const run = (error?: ApiError) =>
    withIdempotencyKey(action, (key) => {
      received.push(key);
      return error ? Promise.reject(error) : Promise.resolve('accepted');
    });

  const lost = new ApiError('NETWORK_ERROR', undefined, undefined);
  const refused = new ApiError('IDEMPOTENCY_CONFLICT', 409, 'r1');
  expect(await run(lost).catch((error: unknown) => error)).toBe(lost);
  expect(await run(refused).catch((error: unknown) => error)).toBe(refused);
  expect(await run()).toBe('accepted');
  expect(await run()).toBe('accepted');
  expect(received).toHaveLength(4);
  expect(received[0]).toMatch(uuid);
  expect(received[1]).toBe(received[0]);
  expect(received[2]).not.toBe(received[1]);
  expect(received[3]).not.toBe(received[2]);
});
