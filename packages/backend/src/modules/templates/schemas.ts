import { z } from 'zod';

import { fieldKeySchema } from '../../profiles/bfl/fields';

const paragraph = z.object({
  text: z.string(),
  align: z.enum(['left', 'center', 'right', 'justify']),
  bold: z.boolean(),
  fontSize: z.number(),
  indent: z.number(),
  after: z.number(),
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
const document = z.object({
  id: z.string(),
  version: z.string(),
  title: z.string(),
  filename: z.string(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  blocks: z.array(block),
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
