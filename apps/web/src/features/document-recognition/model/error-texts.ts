import { ApiError, describeApiError, sharedCodeTexts } from '@/lib/api/errors';

export const recognitionRetryCode = 'OCR_RETRY_REQUIRED';
export const recognitionRetryText = 'Документ нужно распознать заново';

const documentTexts = {
  codes: {
    ...sharedCodeTexts,
    DELETION_PENDING:
      'Удаление ещё выполняется. Файлы пока не считаются удалёнными; повторите проверку позже.',
    DELETION_NEEDS_RECOVERY:
      'Удаление требует восстановления незавершённой записи в хранилище. Статус «удалено» ещё не подтверждён.',
    PAYLOAD_TOO_LARGE: 'Файл слишком большой. Максимум — 20 МБ.',
    INVALID_DOCUMENT:
      'Не удалось прочитать файл. Проверьте, что его содержимое соответствует формату PDF, DOCX или изображения.',
    UNSUPPORTED_DOCUMENT_FORMAT:
      'Поддерживаются PDF, DOCX, JPEG, PNG, WebP и TIFF.',
    REQUEST_TIMEOUT:
      'Сервер не ответил вовремя. Обновите список, чтобы проверить результат.',
    RETRY_CONFLICT: 'Файл уже обрабатывается или больше не требует повтора.',
  },
  technical: 'Не удалось выполнить действие. Попробуйте ещё раз.',
  fallback: 'Не удалось выполнить действие. Попробуйте ещё раз.',
};

export function describeDocumentError(error: unknown) {
  if (!(error instanceof ApiError)) return 'Не удалось выполнить действие.';
  const text = describeApiError(error, documentTexts);
  return error.requestId ? `${text} Код обращения: ${error.requestId}` : text;
}
