import { describeApiError, sharedCodeTexts } from '@/lib/api/errors';

import { workCommandReasons, workRevisionConflictText } from './command-errors';

const uploadTexts = {
  codes: {
    ...sharedCodeTexts,
    WORK_BUSY: workCommandReasons.WORK_BUSY,
    CLEANUP_PENDING: workCommandReasons.CLEANUP_PENDING,
    REVISION_CONFLICT: workRevisionConflictText,
    UNSUPPORTED_DOCUMENT_FORMAT:
      'Поддерживаются PDF, DOCX, JPEG, PNG, WebP, TIFF, AVIF и HEIF/HEIC.',
    INVALID_DOCUMENT:
      'Содержимое файла не соответствует формату или файл повреждён.',
    PAYLOAD_TOO_LARGE: 'Размер файла превышает 20 МБ.',
    NOT_READY:
      'У выбранного файла больше нет доступного результата. Выберите файл заново.',
    REQUEST_TIMEOUT:
      'Не удалось получить ответ сервера. Обновите список перед повторной загрузкой.',
    NETWORK_ERROR:
      'Не удалось получить ответ сервера. Обновите список перед повторной загрузкой.',
  },
  technical: 'Не удалось загрузить файл. Повторите попытку.',
  fallback: 'Не удалось загрузить файл. Повторите попытку.',
  includeClientReference: true,
};

export function uploadFailureMessage(
  filename: string,
  failure: unknown,
): string {
  return `${filename}: ${describeApiError(failure, uploadTexts)}`;
}
