import { ApiError } from '../../lib/api/client';

export class UploadFailure extends Error {}

export function uploadFailureMessage(
  filename: string,
  failure: unknown,
): string {
  const code = failure instanceof ApiError ? failure.code : '';
  const reason =
    code === 'UNSUPPORTED_DOCUMENT_FORMAT'
      ? 'Поддерживаются PDF, DOCX, JPEG, PNG, WebP и TIFF.'
      : code === 'INVALID_DOCUMENT'
        ? 'Содержимое файла не соответствует формату или файл повреждён.'
        : code === 'PAYLOAD_TOO_LARGE'
          ? 'Размер файла превышает 20 МБ.'
          : code === 'REQUEST_TIMEOUT' || code === 'NETWORK_ERROR'
            ? 'Не удалось получить ответ сервера. Обновите список перед повторной загрузкой.'
            : 'Не удалось загрузить файл. Повторите попытку.';
  return `${filename}: ${reason}${failure instanceof ApiError && failure.requestId ? ` Код обращения: ${failure.requestId}.` : ''}`;
}
