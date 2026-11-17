import { describeApiError, sharedCodeTexts } from '@/lib/api/errors';

// Тексты сохранения сведений по кодам endpoint editWork из contracts. Полнота проверяется типом:
// новый код ошибки endpoint без текста не скомпилируется.
const factsSaveTexts = {
  codes: {
    FORBIDDEN: sharedCodeTexts.FORBIDDEN,
    NOT_FOUND: 'Работа не найдена. Обновите страницу.',
    CLEANUP_PENDING:
      'Исходник файла удаляется, поэтому сведения сейчас нельзя сохранить.',
    REVISION_CONFLICT:
      'Работа изменилась во время сохранения. Правки перенесены на новую версию: проверьте их и сохраните ещё раз.',
    INVALID_WORK_INPUT: 'Сведения не приняты: проверьте значения полей.',
  } satisfies Record<
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'CLEANUP_PENDING'
    | 'REVISION_CONFLICT'
    | 'INVALID_WORK_INPUT',
    string
  >,
  fallback: 'Не удалось сохранить сведения. Повторите попытку.',
};

export function describeFactsSaveError(error: unknown): string {
  return describeApiError(error, factsSaveTexts);
}

// Существительное при числе: 1 поле, 2 поля, 5 полей (по правилам русского склонения).
export function fieldsWord(count: number): string {
  const last = count % 10;
  const tens = count % 100;
  if (last === 1 && tens !== 11) return 'поле';
  if (last >= 2 && last <= 4 && (tens < 12 || tens > 14)) return 'поля';
  return 'полей';
}

export function conflictSummary(count: number): string {
  const verb = count === 1 ? 'изменено' : 'изменены';
  return `Работа изменилась: ${String(count)} ${fieldsWord(count)} ${verb} и вами, и на сервере`;
}
