import {
  documentImageLimit,
  type DocumentView,
} from '@anyko/backend/documents';
import { documentProcessingMessage } from '@anyko/contracts/documents';

export function documentSummary(document: DocumentView) {
  const errorMessage =
    document.errorCode === 'OCR_TOO_MANY_IMAGES'
      ? `В документе слишком много изображений. Максимум — ${String(documentImageLimit)}.`
      : documentProcessingMessage(document.errorCode);
  return errorMessage ? { ...document, errorMessage } : document;
}
