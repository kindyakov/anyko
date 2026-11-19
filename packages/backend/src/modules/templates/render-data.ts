import {
  emptyFieldValues,
  fieldDefinitions,
  type FieldValues,
  readFieldValues,
} from '../../profiles/bfl/fields';

/** Projection only: unknown values stay visibly unknown; no legal or financial inference. */
export function templateData(
  input: FieldValues,
  templateVersion?: string,
): FieldValues & { signerName: string } {
  const values = readFieldValues(input);
  const output = emptyFieldValues();
  for (const field of fieldDefinitions) {
    const value = values[field.key];
    if (
      templateVersion === 'bfl-statement-v4' &&
      Array.isArray(value) &&
      !value.length &&
      ['debts', 'businessDebts', 'attachments'].includes(field.key)
    ) {
      output[field.key] = [];
      continue;
    }
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
  const surname =
    typeof values.lastName === 'string' ? values.lastName.trim() : '';
  const initials = [values.firstName, values.middleName]
    .map((value) =>
      typeof value === 'string'
        ? value.trim().match(/^\p{L}/u)?.[0]
        : undefined,
    )
    .flatMap((initial) => (initial ? [`${initial.toUpperCase()}.`] : []))
    .join('');
  return {
    ...output,
    signerName: surname
      ? `${surname}${initials ? ` ${initials}` : ''}`
      : '[не заполнено]',
  };
}
