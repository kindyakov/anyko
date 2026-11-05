import {
  fieldDefinitions,
  readFieldValues,
  emptyFieldValues,
} from '@anyko/contracts';
import type { FieldValues } from '@anyko/contracts';

/** Projection only: unknown values stay visibly unknown; no legal or financial inference. */
export function templateData(input: FieldValues): FieldValues {
  const values = readFieldValues(input);
  const output = emptyFieldValues();
  for (const field of fieldDefinitions) {
    const value = values[field.key];
    if (!field.columns.length) {
      output[field.key] = typeof value === 'string' ? value : '[не заполнено]';
      continue;
    }
    const rows =
      Array.isArray(value) && value.length
        ? value
        : [
            Object.fromEntries(
              field.columns.map(({ key }, i) => [
                key,
                i === 0
                  ? value === null
                    ? '[не заполнено]'
                    : 'Отсутствует'
                  : '—',
              ]),
            ),
          ];
    output[field.key] = rows.map((row, index) => ({
      ...Object.fromEntries(
        field.columns.map(({ key }) => [key, row[key] ?? '[не заполнено]']),
      ),
      rowNumber: String(index + 1),
    }));
  }
  return output;
}
