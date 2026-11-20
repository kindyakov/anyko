import { z } from 'zod';

import { cursorResponseSchema } from '../common';

export const sourceFormatSchema = z.enum([
  'pdf',
  'docx',
  'jpg',
  'png',
  'webp',
  'tiff',
  'avif',
  'heif',
]);
export type SourceFormat = z.infer<typeof sourceFormatSchema>;

export const documentSchema = z.object({
  id: z.string().min(1),
  filename: z.string(),
  status: z.enum(['queued', 'running', 'succeeded', 'failed']),
  createdAt: z.iso.datetime(),
  errorCode: z.string().nullable().optional(),
  errorMessage: z.string().optional(),
  processingRevision: z.number().int().positive().optional(),
  readyRevision: z.number().int().positive().nullable().optional(),
  linkedWorks: z
    .array(z.object({ id: z.string().min(1), title: z.string() }))
    .optional(),
});
export const documentResponseSchema = z.object({ document: documentSchema });
export const sourceChecksumSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .describe('SHA-256 оригинала в hex');
export const documentsResponseSchema = cursorResponseSchema(documentSchema, {
  checksum: sourceChecksumSchema.optional(),
  pendingDeletions: z.array(
    z.object({
      id: z.string().min(1),
      createdAt: z.iso.datetime(),
      status: z.enum(['deleting', 'needs-recovery']),
    }),
  ),
});
export const documentResultSchema = z.object({
  markdown: z.string(),
  processorVersion: z.string(),
  images: z.array(z.object({ path: z.string(), url: z.string() })).default([]),
});
// Файл исходного документа; общий предел для загрузки в работу и в документы.
export const uploadFileSchema = z.file().max(20 * 1024 * 1024);
export const deletingStatusSchema = z.object({ status: z.literal('deleting') });
export const documentDeletionSchema = z.object({
  status: z.enum(['deleting', 'deleted', 'needs-recovery']),
});
export type DocumentSummary = z.infer<typeof documentSchema>;
