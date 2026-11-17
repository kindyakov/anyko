import { expect, test } from 'bun:test';

import { documentsResponseSchema } from '@anyko/contracts/documents';

import { type HttpFetch, requestApi } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';

function failWith(body: unknown, status = 400) {
  const fake: HttpFetch = () =>
    Promise.resolve(
      Response.json(body, { status, headers: { 'x-request-id': 'r1' } }),
    );
  return requestApi('/works', documentsResponseSchema, {
    method: 'POST',
    fetch: fake,
  }).catch((failure: unknown) => failure);
}

test('invalid response passes its field list to the ApiError', async () => {
  const failure = await failWith({
    error: {
      code: 'INVALID_REQUEST',
      requestId: 'r1',
      fields: [{ path: ['title'], code: 'too_long' }],
    },
  });
  expect(failure).toBeInstanceOf(ApiError);
  expect(failure).toMatchObject({
    code: 'INVALID_REQUEST',
    status: 400,
    requestId: 'r1',
    fields: [{ path: ['title'], code: 'too_long' }],
  });
});

test('error without fields leaves the field list absent', async () => {
  const failure = await failWith(
    { error: { code: 'NOT_FOUND', requestId: 'r1' } },
    404,
  );
  expect(failure).toBeInstanceOf(ApiError);
  expect((failure as ApiError).fields).toBeUndefined();
});

test('body that is not an error envelope gives HTTP_ERROR without fields', async () => {
  const failure = await failWith({ private: 'private-fixture' }, 500);
  expect(failure).toMatchObject({ code: 'HTTP_ERROR', status: 500 });
  expect((failure as ApiError).fields).toBeUndefined();
});
