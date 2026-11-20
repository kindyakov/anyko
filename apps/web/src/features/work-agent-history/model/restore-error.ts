import type { editWork } from '@anyko/contracts/works';

import { describeApiError, sharedCodeTexts } from '@/lib/api/errors';

const codes = {
  FORBIDDEN: sharedCodeTexts.FORBIDDEN,
  NOT_FOUND: 'Изменение поля недоступно в истории этой работы.',
  CLEANUP_PENDING: 'Дождитесь удаления источника и повторите восстановление.',
  REVISION_CONFLICT:
    'Сведения изменились. Проверьте текущую редакцию работы и повторите восстановление, если оно ещё нужно.',
  INVALID_WORK_INPUT: 'Прежнее значение поля больше нельзя восстановить.',
} satisfies Record<(typeof editWork.errors)[number], string>;

export function describeFieldRestoreError(error: unknown) {
  return describeApiError(error, {
    codes,
    fallback: 'Не удалось восстановить значение поля. Повторите попытку.',
  });
}
