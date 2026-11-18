import { ApiError, describeApiError, sharedCodeTexts } from '@/lib/api/errors';

const uploadTexts = {
  codes: {
    ...sharedCodeTexts,
    UNSUPPORTED_DOCUMENT_FORMAT:
      'Поддерживаются PDF, DOCX, JPEG, PNG, WebP, TIFF, AVIF и HEIF/HEIC.',
    INVALID_DOCUMENT:
      'Содержимое файла не соответствует формату или файл повреждён.',
    PAYLOAD_TOO_LARGE: 'Размер файла превышает 20 МБ.',
    REQUEST_TIMEOUT:
      'Не удалось получить ответ сервера. Обновите список перед повторной загрузкой.',
    NETWORK_ERROR:
      'Не удалось получить ответ сервера. Обновите список перед повторной загрузкой.',
  },
  technical: 'Не удалось загрузить файл. Повторите попытку.',
  fallback: 'Не удалось загрузить файл. Повторите попытку.',
};

export function uploadFailureMessage(
  filename: string,
  failure: unknown,
): string {
  const reason = describeApiError(failure, uploadTexts);
  const requestId = failure instanceof ApiError ? failure.requestId : undefined;
  return `${filename}: ${reason}${requestId ? ` Код обращения: ${requestId}.` : ''}`;
}
