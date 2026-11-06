import { expect, test } from 'bun:test';
import { z } from 'zod';
import { llmError } from '@anyko/llm';
function failureCode(promise: Promise<unknown>) {
  return promise.then(
    () => 'UNEXPECTED_SUCCESS',
    (error: unknown) => llmError(error).code,
  );
}
import { retryVisionResponse } from './vision-retry';

const malformed = () => z.object({ description: z.string() }).parse({});
test('retries malformed structured responses, then returns only validated output', async () => {
  let attempts = 0;
  const delays: number[] = [];
  const result = await retryVisionResponse(
    new AbortController().signal,
    async () => {
      attempts++;
      if (attempts < 3) malformed();
      return await Promise.resolve('valid');
    },
    (ms) => {
      delays.push(ms);
      return Promise.resolve();
    },
  );
  expect(result).toBe('valid');
  expect(attempts).toBe(3);
  expect(delays).toEqual([1000, 2000]);
});
test('persistent malformed output exhausts exactly three attempts', async () => {
  let attempts = 0;
  expect(
    await failureCode(
      retryVisionResponse(
        new AbortController().signal,
        async () => {
          attempts++;
          return await Promise.resolve().then(malformed);
        },
        () => Promise.resolve(),
      ),
    ),
  ).toBe('LLM_INVALID_RESPONSE');
  expect(attempts).toBe(3);
});
test('auth, permanent HTTP failures and programming errors are not repeated', async () => {
  for (const failure of [
    Object.assign(new Error('auth'), { statusCode: 401 }),
    Object.assign(new Error('request'), { statusCode: 400 }),
    new TypeError('bug'),
  ]) {
    let attempts = 0;
    expect(
      await failureCode(
        retryVisionResponse(new AbortController().signal, () => {
          attempts++;
          return Promise.reject(failure);
        }),
      ),
    ).not.toBe('UNEXPECTED_SUCCESS');
    expect(attempts).toBe(1);
  }
});
test('cancellation and a shared deadline prevent another model call during backoff', async () => {
  for (const reason of [
    new DOMException('cancel', 'AbortError'),
    new DOMException('deadline', 'TimeoutError'),
  ]) {
    const controller = new AbortController();
    let attempts = 0;
    expect(
      await failureCode(
        retryVisionResponse(
          controller.signal,
          async () => {
            attempts++;
            return await Promise.resolve().then(malformed);
          },
          () => {
            controller.abort(reason);
            return Promise.resolve();
          },
        ),
      ),
    ).toBe(reason.name === 'TimeoutError' ? 'LLM_TIMEOUT' : 'LLM_CANCELLED');
    expect(attempts).toBe(1);
  }
});
