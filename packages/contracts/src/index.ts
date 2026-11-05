import { z } from 'zod';

export const healthResponseSchema = z.object({ status: z.literal('ok') });
export const httpErrorSchema = z.object({
  error: z.object({
    code: z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/),
    requestId: z.string().max(128),
  }),
});
export const sessionResponseSchema = z.object({
  user: z.object({ id: z.string(), name: z.string(), email: z.email() }),
  workspace: z.object({ id: z.string(), name: z.string() }),
});
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
});
export const documentResultSchema = z.object({
  markdown: z.string(),
  processorVersion: z.string(),
});
export type DocumentSummary = z.infer<typeof documentSchema>;
export type Session = z.infer<typeof sessionResponseSchema>;
