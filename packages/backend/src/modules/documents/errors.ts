import { defineErrors } from '../../platform/errors';

export const DocumentErrors = defineErrors({
  NOT_FOUND: 'not_found',
  INVALID_DOCUMENT: 'invalid',
  UNSUPPORTED_DOCUMENT_FORMAT: 'invalid',
  NOT_READY: 'precondition',
  RETRY_CONFLICT: 'conflict',
  IDEMPOTENCY_CONFLICT: 'conflict',
});

export class DocumentError extends DocumentErrors.Failure {}
