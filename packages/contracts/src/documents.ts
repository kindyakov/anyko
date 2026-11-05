import { z } from 'zod';

export const documentSchema = z.object({
  id: z.string().min(1),
  filename: z.string(),
  status: z.enum(['queued', 'running', 'succeeded', 'failed']),
  createdAt: z.iso.datetime(),
  errorCode: z.string().nullable().optional(),
});
export const documentResponseSchema = z.object({ document: documentSchema });
export const documentsResponseSchema = z.object({
  documents: z.array(documentSchema),
  deletions: z.array(
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
export type DocumentSummary = z.infer<typeof documentSchema>;
