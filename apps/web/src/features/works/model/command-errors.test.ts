import { expect, test } from 'bun:test';

import { ApiError } from '@/lib/api/errors';

import { describeWorkCommandError } from './command-errors';

test('work commands explain idempotency and access refusals in Russian', () => {
  expect(
    describeWorkCommandError(new ApiError('IDEMPOTENCY_IN_PROGRESS', 409, 'r')),
  ).toBe('Предыдущий запрос ещё выполняется. Подождите и повторите.');
  expect(
    describeWorkCommandError(new ApiError('IDEMPOTENCY_CONFLICT', 409, 'r')),
  ).toBe('Запрос уже отправлялся с другими данными. Повторите действие.');
  expect(describeWorkCommandError(new ApiError('FORBIDDEN', 403, 'r'))).toBe(
    'Недостаточно прав для этого действия.',
  );
});

test('a revision conflict tells the user the facts were refreshed and the action can be repeated', () => {
  expect(
    describeWorkCommandError(new ApiError('REVISION_CONFLICT', 409, 'r')),
  ).toBe(
    'Работа изменилась, пока вы действовали. Сведения обновлены — проверьте их и повторите действие.',
  );
});

test('an unexpected failure shows the generic text without raw details', () => {
  expect(describeWorkCommandError(new Error('private provider body'))).toBe(
    'Операция не выполнена. Повторите попытку.',
  );
});
