import { expect, test } from 'bun:test';

import { ApiError } from '@/lib/api/errors';

import {
  conflictSummary,
  describeFactsSaveError,
  fieldsWord,
} from './facts-messages';

test('a revision conflict on save tells the user the edits were carried over', () => {
  expect(
    describeFactsSaveError(new ApiError('REVISION_CONFLICT', 409, 'r')),
  ).toContain('Правки перенесены на новую версию');
});

test('a save refused by cleanup or by access explains the reason in Russian', () => {
  expect(
    describeFactsSaveError(new ApiError('CLEANUP_PENDING', 409, 'r')),
  ).toContain('удаляется');
  expect(describeFactsSaveError(new ApiError('FORBIDDEN', 403, 'r'))).toBe(
    'Недостаточно прав для этого действия.',
  );
});

test('an unexpected failure shows the save text without raw details', () => {
  expect(describeFactsSaveError(new Error('private provider body'))).toBe(
    'Не удалось сохранить сведения. Повторите попытку.',
  );
});

test('the noun follows the Russian plural rules', () => {
  expect(fieldsWord(1)).toBe('поле');
  expect(fieldsWord(2)).toBe('поля');
  expect(fieldsWord(4)).toBe('поля');
  expect(fieldsWord(5)).toBe('полей');
  expect(fieldsWord(11)).toBe('полей');
  expect(fieldsWord(12)).toBe('полей');
  expect(fieldsWord(21)).toBe('поле');
  expect(fieldsWord(22)).toBe('поля');
});

test('the conflict summary names the count and agrees the verb with it', () => {
  expect(conflictSummary(1)).toBe(
    'Работа изменилась: 1 поле изменено и вами, и на сервере',
  );
  expect(conflictSummary(3)).toBe(
    'Работа изменилась: 3 поля изменены и вами, и на сервере',
  );
  expect(conflictSummary(7)).toBe(
    'Работа изменилась: 7 полей изменены и вами, и на сервере',
  );
});
