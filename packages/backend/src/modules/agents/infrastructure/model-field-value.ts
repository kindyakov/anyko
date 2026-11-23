import { z } from 'zod';

import { creditorRegistryColumns } from '@anyko/document-values/obligations';

import { candidateSchema } from '../../../profiles/bfl/candidate';
import type { FieldDefinition, FieldValue } from '../../../profiles/bfl/fields';

const evidenceEntry = candidateSchema.shape.evidence.element;
const unpagedEvidence = evidenceEntry.omit({ page: true }).extend({
  quote: evidenceEntry.shape.quote.min(1),
});
// In strict mode each branch must declare all its properties as required.
const evidence = z
  .array(
    z.union([
      unpagedEvidence,
      unpagedEvidence.extend({ page: evidenceEntry.shape.page.unwrap() }),
    ]),
  )
  .min(1)
  .max(12);

export function modelFields(fields: readonly FieldDefinition[]) {
  return fields
    .filter(({ key }) => key !== 'submittedAttachments')
    .map((field) => ({
      ...field,
      columns: field.columns.filter(
        ({ key }) => !Object.hasOwn(creditorRegistryColumns, key),
      ),
    }));
}

export function modelCandidateSchema(
  fields: readonly FieldDefinition[],
  reconciliation: boolean,
) {
  const common = { evidence };
  const origin = reconciliation
    ? {
        origin: z.enum(['document', 'inference']),
        explanation: z.string().min(1).max(2000).nullable(),
      }
    : {};
  const textFields = fields.filter(({ kind }) => kind === 'text');
  const branches = [
    ...(textFields.length
      ? [
          z.strictObject({
            ...common,
            ...origin,
            field: z.enum(textFields.map(({ key }) => key)),
            value: z.string().min(1).max(12000),
          }),
        ]
      : []),
    ...fields
      .filter(({ kind }) => kind === 'rows')
      .map(({ key, columns }) => {
        const row = z
          .array(
            z.strictObject({
              column: z.enum(columns.map(({ key }) => key)),
              value: z.string().max(4000).nullable(),
            }),
          )
          .min(1)
          .max(columns.length);
        const isObligation = columns.some(({ key }) => key === 'debtStatus');
        const rows = z.array(row);
        return z.strictObject({
          ...common,
          ...origin,
          field: z.enum([key]),
          value: isObligation
            ? key === 'businessDebts'
              ? rows.max(1)
              : rows.length(1)
            : rows.max(100),
        });
      }),
  ];
  return z.union(branches);
}

export const modelFieldValueInstructions =
  'Строковое поле верни непустой строкой. Табличное value — массив строк, каждая строка — массив ячеек {"column":"ключ колонки","value":"значение"}, например [[{"column":"amount","value":"100.00"}]]. Сохраняй оба уровня массива даже для одной строки. Используй ключи колонок поля, каждый ключ не более одного раза в строке.';

export const modelQuoteInstructions =
  'В quote цитируй дословно, пробелы и переносы можно свернуть в пробел. Цитируй содержимое одной ячейки как оно записано в тексте. Для нескольких ячеек дай отдельные цитаты. Для текста imagePath=null, для описания изображения укажи его точный imagePath. Не переноси разметку из описания картинки в текстовую цитату. Указывай page, только если известен физический номер страницы (целое число от 1).';

type ModelValue = z.infer<ReturnType<typeof modelCandidateSchema>>['value'];

export function decodeModelFieldValue(value: ModelValue) {
  if (!Array.isArray(value)) return value;
  if (
    value.some(
      (row) => new Set(row.map(({ column }) => column)).size !== row.length,
    )
  )
    return null;
  return value.map((row) =>
    Object.fromEntries(row.map(({ column, value }) => [column, value])),
  );
}

export function encodeModelFieldValue(
  value: FieldValue,
  field: FieldDefinition,
) {
  if (!Array.isArray(value)) return value;
  return value.map((row) =>
    field.columns.flatMap(({ key }) =>
      Object.hasOwn(row, key) ? [{ column: key, value: row[key] ?? null }] : [],
    ),
  );
}
