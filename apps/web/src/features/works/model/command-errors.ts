import { describeApiError, sharedCodeTexts } from '@/lib/api/errors';

// Тексты команд над работой: анализ, подтверждение, правки, формирование и загрузка файлов.
const workCommandTexts = {
  codes: {
    ...sharedCodeTexts,
    REVISION_CONFLICT:
      'Работа изменилась, пока вы действовали. Сведения обновлены — проверьте их и повторите действие.',
  },
  fallback: 'Операция не выполнена. Повторите попытку.',
};

export function describeWorkCommandError(error: unknown): string {
  return describeApiError(error, workCommandTexts);
}
