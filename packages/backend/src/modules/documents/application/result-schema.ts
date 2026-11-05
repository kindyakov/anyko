import { z } from 'zod';
export const documentResultSchema = z.object({
  markdown: z.string().max(4 * 1024 * 1024),
  processorVersion: z.string().min(1).max(128),
});
