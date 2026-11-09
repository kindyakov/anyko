import { z } from 'zod';

import { fieldKeySchema } from './work-fields';

export const previewParagraphSchema = z.object({
  text: z.string(),
  align: z.enum(['left', 'center', 'right', 'justify']),
  bold: z.boolean(),
  fontSize: z.number(),
  indent: z.number(),
  after: z.number(),
});
export const previewCellSchema = z.object({
  paragraphs: z.array(previewParagraphSchema),
  span: z.number().int().min(1),
  rowSpan: z.number().int().min(1).default(1),
  merge: z.enum(['none', 'start', 'continue']),
});
export const previewRowSchema = z.object({
  repeat: fieldKeySchema.nullable(),
  cells: z.array(previewCellSchema),
});
export const previewBlockSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('paragraph'), paragraph: previewParagraphSchema }),
  z.object({
    kind: z.literal('table'),
    widths: z.array(z.number()),
    bordered: z.boolean().default(true),
    rows: z.array(previewRowSchema),
  }),
]);
export const documentTemplateSchema = z.object({
  id: z.string(),
  version: z.string(),
  title: z.string(),
  filename: z.string(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  blocks: z.array(previewBlockSchema),
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
      columns: z.array(z.object({ key: z.string(), label: z.string() })),
    }),
  ),
  documents: z.array(documentTemplateSchema).min(1).max(30),
});
export const packagesResponseSchema = z.object({
  packages: z.array(documentPackageSchema),
});
export type DocumentPackage = z.infer<typeof documentPackageSchema>;
export type DocumentTemplate = z.infer<typeof documentTemplateSchema>;
export type PreviewBlock = z.infer<typeof previewBlockSchema>;
export type PreviewParagraph = z.infer<typeof previewParagraphSchema>;
export type PreviewRow = z.infer<typeof previewRowSchema>;
export const generationFileSchema = z.object({
  id: z.uuid(),
  templateVersion: z.string(),
  title: z.string(),
  filename: z.string(),
  status: z.enum(['queued', 'succeeded', 'failed']),
  errorCode: z.string().nullable(),
});
