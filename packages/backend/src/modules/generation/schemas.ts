import { z } from 'zod';

export const generationFileSchema = z.object({
  id: z.uuid(),
  templateVersion: z.string(),
  title: z.string(),
  filename: z.string(),
  status: z.enum(['queued', 'succeeded', 'failed']),
  errorCode: z.string().nullable(),
});
export const generationSchema = z.object({
  id: z.uuid(),
  revision: z.number().int(),
  confirmed: z.boolean(),
  status: z.enum(['queued', 'succeeded', 'partial', 'failed']),
  files: z.array(generationFileSchema),
  createdAt: z.iso.datetime(),
});
export type GenerationView = z.infer<typeof generationSchema>;
