import type { WorkChecklistItem } from '@anyko/contracts/works';
import type { Tone } from '@anyko/ui';

/** Подпись и тон статуса пункта чек-листа и его источника. */
export const statuses: Record<WorkChecklistItem['status'], [string, Tone]> = {
  confirmed: ['Подтверждено', 'success'],
  found: ['Найдено', 'success'],
  review: ['На проверке', 'progress'],
  missing: ['Не найдено', 'neutral'],
  clarify: ['Уточнить', 'neutral'],
};
