import { z } from 'zod';

export const llmSettingsInputSchema = z
  .object({
    baseURL: z.url().max(500),
    visionModel: z.string().min(1).max(200),
    extractionModel: z.string().min(1).max(200),
    apiKey: z.string().min(1).max(8192).optional(),
  })
  .strict();
export const llmSettingsResponseSchema = z.object({
  settings: z
    .object({
      revision: z.number().int(),
      baseURL: z.string(),
      visionModel: z.string(),
      extractionModel: z.string(),
      configured: z.boolean(),
    })
    .nullable(),
  canManage: z.boolean(),
});
export const savedStatusSchema = z.object({ status: z.literal('saved') });
