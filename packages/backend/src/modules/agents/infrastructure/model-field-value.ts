import { z } from 'zod';

import { fieldValueSchema } from '../../../profiles/bfl/fields';

const cell = z.strictObject({
  column: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/),
  value: z.string().max(4000).nullable(),
});
type Cell = z.infer<typeof cell>;

// Strict provider JSON schemas require named properties. Dynamic row
// objects lose their columns when the SDK closes their schema.
export const modelFieldValue = z
  .union([
    z.string().max(12000),
    z.array(z.array(cell).min(1).max(100)).max(100),
  ])
  .nullable();

// During tool use, some models omit the outer brackets for a single row.
export const modelReconciliationFieldValue = z.union([
  modelFieldValue,
  z.array(cell).min(1).max(100),
]);

export const modelFieldValueInstructions =
  'Строковое поле верни строкой. Для табличного поля value — массив строк, каждая строка — массив ячеек {"column":"ключ колонки","value":"значение"}, например [[{"column":"amount","value":"100.00"}]]. Неизвестные колонки пропускай. Каждую колонку указывай один раз в строке.';

export function decodeModelFieldValue(
  value: z.infer<typeof modelReconciliationFieldValue>,
) {
  if (!Array.isArray(value)) return value;
  if (value.length === 0) return [];
  const rows = value.every((row): row is Cell => !Array.isArray(row))
    ? [value]
    : value.filter((row): row is Cell[] => Array.isArray(row));
  if (
    rows.some(
      (row) => new Set(row.map(({ column }) => column)).size !== row.length,
    )
  )
    return null;
  return rows.map((row) =>
    Object.fromEntries(row.map(({ column, value }) => [column, value])),
  );
}

export function decodeReconciliationFieldValue(value: unknown) {
  const wire = modelReconciliationFieldValue.safeParse(value);
  if (wire.success) return decodeModelFieldValue(wire.data);

  // Models can echo the row objects shown by readField and previous context.
  const echoed = fieldValueSchema.safeParse(value);
  if (
    echoed.success &&
    Array.isArray(echoed.data) &&
    echoed.data.every((row) => Object.keys(row).length > 0)
  )
    return echoed.data;
  return null;
}
