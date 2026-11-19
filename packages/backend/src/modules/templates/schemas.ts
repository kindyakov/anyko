import { z } from 'zod';

import { calendarDatePlaceholders } from '@anyko/document-values/calendar-date';

import { fieldKeySchema, isCalendarDateField } from '../../profiles/bfl/fields';

const paragraph = z.object({
  text: z.string(),
  align: z.enum(['left', 'center', 'right', 'justify']),
  bold: z.boolean(),
  fontSize: z.number(),
  indent: z.number(),
  after: z.number(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  boldFields: z.array(z.string()).optional(),
  left: z.number().optional(),
  right: z.number().optional(),
  marker: z.object({ list: z.string(), pattern: z.string() }).optional(),
});
const cell = z.object({
  paragraphs: z.array(paragraph),
  span: z.number().int().min(1),
  rowSpan: z.number().int().min(1).default(1),
  merge: z.enum(['none', 'start', 'continue']),
});
const row = z.object({
  repeat: fieldKeySchema.nullable(),
  cells: z.array(cell),
});
const block = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('paragraph'), paragraph }),
  z.object({
    kind: z.literal('table'),
    widths: z.array(z.number()),
    bordered: z.boolean().default(true),
    rows: z.array(row),
  }),
]);
const bindingKey = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)*$/);
export const templatePlaceholderSchema = z.discriminatedUnion('placeholder', [
  z.object({
    tag: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,79}$/),
    field: fieldKeySchema.refine(isCalendarDateField),
    placeholder: z.enum(calendarDatePlaceholders),
  }),
  z
    .object({
      tag: bindingKey,
      field: bindingKey,
      placeholder: z.literal('identity'),
    })
    .refine(({ tag, field }) => tag === field),
]);
export type TemplatePlaceholder = z.infer<typeof templatePlaceholderSchema>;
const document = z.object({
  id: z.string(),
  version: z.string(),
  title: z.string(),
  filename: z.string(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  margins: z
    .object({
      top: z.number().nonnegative(),
      right: z.number().nonnegative(),
      bottom: z.number().nonnegative(),
      left: z.number().nonnegative(),
    })
    .optional(),
  blocks: z.array(block),
  placeholders: z.array(templatePlaceholderSchema).optional(),
});
export const documentPackageSchema = z.object({
  id: z.string(),
  version: z.string(),
  title: z.string(),
  technical: z.boolean(),
  fields: z.array(
    z.object({
      key: fieldKeySchema,
      label: z.string(),
      multiline: z.boolean(),
      kind: z.enum(['text', 'rows']),
      valueType: z.literal('date').optional(),
      limits: z.object({
        maxLength: z.number().int().positive().optional(),
        maxRows: z.number().int().positive().optional(),
      }),
      columns: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          maxLength: z.number().int().positive(),
        }),
      ),
    }),
  ),
  documents: z.array(document).min(1).max(30),
});
export type DocumentPackage = z.infer<typeof documentPackageSchema>;
