import { expect, test } from 'bun:test';

import { describeWorkCommandError } from '@/features/works/model/command-errors';
import { uploadFailureMessage } from '@/features/works/model/upload-errors';
import { ApiError } from '@/lib/api/errors';

test('upload feedback identifies file and actionable reason without exposing raw errors', () => {
  expect(
    uploadFailureMessage(
      'scheme.spl7',
      new ApiError('UNSUPPORTED_DOCUMENT_FORMAT', 400, 'trace'),
    ),
  ).toContain('scheme.spl7: Поддерживаются PDF');
  expect(
    uploadFailureMessage(
      'broken.pdf',
      new ApiError('INVALID_DOCUMENT', 400, undefined),
    ),
  ).toContain('повреждён');
  expect(
    uploadFailureMessage(
      'big.pdf',
      new ApiError('PAYLOAD_TOO_LARGE', 413, undefined),
    ),
  ).toContain('20 МБ');
  expect(
    uploadFailureMessage(
      'uncertain.pdf',
      new ApiError('REQUEST_TIMEOUT', undefined, undefined),
    ),
  ).toContain('Обновите список');
  expect(
    uploadFailureMessage('a.pdf', new Error('private provider body')),
  ).not.toContain('private');
});

test.each([
  ['REVISION_CONFLICT', 'Работа изменилась'],
  ['CLEANUP_PENDING', 'завершения очистки'],
  ['FORBIDDEN', 'Недостаточно прав'],
  ['WORK_BUSY', 'завершения обработки'],
])('upload gives actionable feedback for %s', (code, message) => {
  expect(
    uploadFailureMessage('scan.pdf', new ApiError(code, 409, undefined)),
  ).toContain(message);
});

test('NOT_READY distinguishes a stale source selection from a generic unmet prerequisite', () => {
  expect(
    describeWorkCommandError(
      new ApiError('NOT_READY', 409, undefined, [
        { path: ['documentIds', 0], code: 'invalid_value' },
      ]),
    ),
  ).toContain('исходный файл');
  expect(
    describeWorkCommandError(new ApiError('NOT_READY', 409, undefined)),
  ).not.toContain('подтвердите сведения');
});
