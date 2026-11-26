import { z } from 'zod';

export const fieldKeySchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[^{}#/]+$/);
export type FieldKey = z.infer<typeof fieldKeySchema>;

const fieldRowSchema = z.record(
  z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/),
  z.string().max(4000).nullable(),
);
export const fieldValueSchema = z
  .union([z.string().max(12000), z.array(fieldRowSchema).max(100)])
  .nullable();
export const storedFieldValuesSchema = z.record(
  fieldKeySchema,
  fieldValueSchema,
);
export type FieldRow = z.infer<typeof fieldRowSchema>;
export type FieldValue = z.infer<typeof fieldValueSchema>;
export type FieldValues = z.infer<typeof storedFieldValuesSchema>;

export const valueTypeSchema = z.enum([
  'inn',
  'snils',
  'passport',
  'address',
  'date',
  'money',
]);

export interface ValueDefinition {
  valueType?: z.infer<typeof valueTypeSchema> | undefined;
  innLength?: 12 | undefined;
}

export interface FieldColumn extends ValueDefinition {
  key: string;
  label: string;
  maxLength: number;
  moneyFormat?: 'sourceCurrency' | undefined;
  evidence?: 'row' | 'sourceCurrency' | undefined;
}

export interface FieldDefinition extends ValueDefinition {
  key: FieldKey;
  label: string;
  role?: string | undefined;
  multiline: boolean;
  kind: 'text' | 'rows';
  limits: { maxLength?: number | undefined; maxRows?: number | undefined };
  columns: FieldColumn[];
}

export function packageValuesSchema(fields: readonly FieldDefinition[]) {
  const definitions = new Map(fields.map((field) => [field.key, field]));
  return storedFieldValuesSchema.superRefine((values, ctx) => {
    for (const [key, value] of Object.entries(values)) {
      const field = definitions.get(key);
      if (!field) {
        // Legacy clients sent their complete value map, including unused nulls.
        if (value !== null)
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'UNKNOWN_FIELD',
          });
      } else if (value !== null && field.kind === 'text') {
        if (
          typeof value !== 'string' ||
          value.length > (field.limits.maxLength ?? 12000)
        )
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'EXPECTED_TEXT',
          });
      } else if (
        Array.isArray(value) &&
        value.length <= (field.limits.maxRows ?? 100)
      ) {
        for (const [index, row] of value.entries())
          for (const [column, cell] of Object.entries(row)) {
            const definition = field.columns.find(({ key }) => key === column);
            if (
              !definition ||
              (cell !== null && cell.length > definition.maxLength)
            )
              ctx.addIssue({
                code: 'custom',
                path: [key, index, column],
                message: definition ? 'CELL_TOO_LONG' : 'UNKNOWN_COLUMN',
              });
          }
      } else if (value !== null) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'EXPECTED_ROWS' });
      }
    }
  });
}
