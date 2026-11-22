import { sharedCodeTexts } from '@/lib/api/errors';

const runErrors: Readonly<Record<string, string>> = {
  REVISION_CONFLICT:
    'Сведения изменились во время запроса. Проверьте текущие значения перед повтором.',
  FORBIDDEN: sharedCodeTexts.FORBIDDEN,
  INVALID_WORK_INPUT: 'Уточните, какое поле и какое значение нужно сохранить.',
  CLEANUP_PENDING: 'Дождитесь удаления источника и повторите запрос.',
  LLM_NOT_CONFIGURED: 'Подключите модель в настройках.',
  LLM_COMPLETION_LIMIT: 'Ответ модели оборвался на предельном числе токенов.',
  LLM_STREAM_IDLE: 'Модель перестала отвечать. Отправьте сообщение ещё раз.',
};

export function chatRunErrorText(code: string | null) {
  return (code && runErrors[code]) || 'Не удалось завершить запрос агента.';
}
