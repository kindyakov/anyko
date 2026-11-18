import type { WorkCommandBlockReason } from '@anyko/contracts/works';

import { ApiError, describeApiError, sharedCodeTexts } from '@/lib/api/errors';

export const connectionRevokedText =
  'Подключение модели отозвано. Владелец области может настроить новое в настройках подключения.';

export const workCommandReasons = {
  FACTS_NEED_REVIEW:
    'Проверьте и подтвердите сведения, которые потеряли доказательства.',
  WORK_BUSY: 'Дождитесь завершения обработки работы.',
  CLEANUP_PENDING: 'Дождитесь завершения очистки исходников.',
  NO_DOCUMENTS: 'Сначала добавьте исходные файлы.',
  SOURCE_LIMIT_REACHED:
    'В работе уже 20 файлов. Удалите лишние, чтобы добавить новые.',
  CONNECTION_REVOKED: connectionRevokedText,
  LLM_NOT_CONFIGURED: 'Владелец области должен настроить подключение модели.',
  FORBIDDEN: sharedCodeTexts.FORBIDDEN,
} satisfies Record<WorkCommandBlockReason, string>;

// Тексты команд над работой: анализ, подтверждение, правки, формирование и загрузка файлов.
const workCommandTexts = {
  codes: {
    ...sharedCodeTexts,
    ...workCommandReasons,
    REVISION_CONFLICT:
      'Работа изменилась. Проверьте актуальное состояние и повторите действие.',
  },
  fallback: 'Операция не выполнена. Повторите попытку.',
};

export function describeWorkCommandError(
  error: unknown,
  notReady?: string,
): string {
  if (error instanceof ApiError && error.code === 'NOT_READY') {
    if (error.fields?.some(({ path }) => path[0] === 'documentIds'))
      return 'Выбранный исходный файл больше недоступен. Обновите список и проверьте выбор.';
    return (
      notReady ??
      'Работа пока не готова к этому действию. Проверьте её состояние.'
    );
  }
  return describeApiError(error, workCommandTexts);
}

export const workRevisionConflictText =
  workCommandTexts.codes.REVISION_CONFLICT;
