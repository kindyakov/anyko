import { expect, test } from 'bun:test';

import { uploadFailureMessage } from '@/features/works/upload-errors';
import { ApiError } from '@/lib/api/client';

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
