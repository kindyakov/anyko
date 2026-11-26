import { formatCalendarDate } from './calendar-date';
import { formatMoneyAmount } from './money';

export const missingTemplateValue = '[не заполнено]';

export function formatTemplateValue(
  value: string,
  placeholder: string,
): string {
  return placeholder.startsWith('RUB_')
    ? formatMoneyAmount(value, placeholder)
    : formatCalendarDate(value, placeholder);
}
