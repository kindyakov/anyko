import { expect, test } from 'bun:test';

import { ApiError, describeApiError } from '@/lib/api/errors';

const featureTexts = {
  codes: {
    DELETION_PENDING: 'Удаление ещё выполняется.',
    NETWORK_ERROR: 'Своя формулировка сети.',
  },
  fallback: 'Своя общая формулировка.',
  technical: 'Своя техническая формулировка.',
};

test.each([
  {
    name: 'feature text wins for its own code',
    error: new ApiError('DELETION_PENDING', 202, undefined),
    texts: featureTexts,
    expected: 'Удаление ещё выполняется.',
  },
  {
    name: 'feature text wins over the technical layer',
    error: new ApiError('NETWORK_ERROR', undefined, undefined),
    texts: featureTexts,
    expected: 'Своя формулировка сети.',
  },
  {
    name: 'technical code without feature text uses the feature technical text',
    error: new ApiError('REQUEST_ABORTED', undefined, undefined),
    texts: featureTexts,
    expected: 'Своя техническая формулировка.',
  },
  {
    name: 'server failure without feature text uses the feature technical text',
    error: new ApiError('INTERNAL_ERROR', 503, 'request-1'),
    texts: featureTexts,
    expected: 'Своя техническая формулировка.',
  },
  {
    name: 'client error with unknown code uses the feature fallback',
    error: new ApiError('CONFLICT_OF_SOMETHING', 409, undefined),
    texts: featureTexts,
    expected: 'Своя общая формулировка.',
  },
  {
    name: 'service keys are not read as API codes',
    error: new ApiError('technical', 400, undefined),
    texts: featureTexts,
    expected: 'Своя общая формулировка.',
  },
  {
    name: 'non-API failure never shows its raw message',
    error: new Error('private provider body'),
    texts: featureTexts,
    expected: 'Своя общая формулировка.',
  },
  {
    name: 'without any table the common technical text applies',
    error: new ApiError('HTTP_ERROR', 500, undefined),
    texts: undefined,
    expected: 'Не удалось получить ответ сервера. Повторите попытку позже.',
  },
  {
    name: 'without any table the common fallback applies',
    error: new ApiError('SOMETHING_ELSE', 400, undefined),
    texts: undefined,
    expected: 'Операция не выполнена. Повторите попытку.',
  },
])('$name', ({ error, texts, expected }) => {
  expect(describeApiError(error, texts)).toBe(expected);
});
