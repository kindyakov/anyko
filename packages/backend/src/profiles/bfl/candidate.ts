import { z } from 'zod';

import { fieldKeySchema, fieldValueIssue, fieldValueSchema } from './fields';

export const candidateSchema = z
  .object({
    origin: z.enum(['document', 'context']).optional(),
    field: fieldKeySchema,
    value: fieldValueSchema.refine(
      (value) =>
        value !== null &&
        (typeof value !== 'string' || value.trim().length > 0),
    ),
    evidence: z
      .array(
        z
          .object({
            documentId: z.uuid(),
            imagePath: z.string().max(240).nullable(),
            quote: z.string().max(2000),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict()
  .superRefine((value, ctx) => {
    const issue = fieldValueIssue(value.field, value.value);
    if (issue)
      ctx.addIssue({ code: 'custom', path: ['value'], message: issue });
  });
