import { describeApiError, sharedCodeTexts } from '@/lib/api/errors';

export const connectionRevokedText =
  'Подключение модели отозвано. Владелец области может настроить новое в настройках подключения.';

// Тексты команд над работой: анализ, подтверждение, правки, формирование и загрузка файлов.
const workCommandTexts = {
  codes: {
    ...sharedCodeTexts,
    CONNECTION_REVOKED: connectionRevokedText,
    REVISION_CONFLICT:
      'Работа изменилась, пока вы действовали. Сведения обновлены — проверьте их и повторите действие.',
  },
  fallback: 'Операция не выполнена. Повторите попытку.',
};

export function describeWorkCommandError(error: unknown): string {
  return describeApiError(error, workCommandTexts);
}
