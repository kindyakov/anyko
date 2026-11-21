import { z } from 'zod';

export const llmSettingsInputSchema = z
  .object({
    baseURL: z.url().max(500),
    visionModel: z.string().min(1).max(200),
    extractionModel: z.string().min(1).max(200),
    visionDisableReasoning: z.boolean().optional(),
    extractionEnableReasoning: z.boolean().optional(),
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
      visionDisableReasoning: z.boolean().default(false),
      extractionEnableReasoning: z.boolean().default(false),
      configured: z.boolean(),
    })
    .nullable(),
  canManage: z.boolean(),
});
export const savedStatusSchema = z.object({ status: z.literal('saved') });
