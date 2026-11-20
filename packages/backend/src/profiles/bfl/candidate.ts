import { z } from 'zod';

import { fieldKeySchema, fieldValueIssue, fieldValueSchema } from './fields';

const candidateBaseSchema = z
  .object({
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
            page: z.number().int().positive().optional(),
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

export const extractedCandidateSchema = candidateBaseSchema.safeExtend({
  origin: z.enum(['document', 'context']).optional(),
});

export const candidateSchema = candidateBaseSchema
  .safeExtend({
    origin: z.enum(['document', 'context', 'inference']).optional(),
    explanation: z.string().trim().min(1).max(2000).optional(),
    courtSources: z
      .strictObject({
        catalogueUrl: z.literal('https://arbitr.ru/'),
        contactUrl: z
          .url()
          .regex(/^https:\/\/[a-z0-9-]+\.arbitr\.ru\/about\/mode$/u),
        checkedAt: z.iso.datetime(),
      })
      .optional(),
  })
  .superRefine(({ field, origin, explanation, courtSources }, ctx) => {
    if ((origin === 'inference') !== (explanation !== undefined))
      ctx.addIssue({
        code: 'custom',
        path: ['explanation'],
        message: 'Only inferred values require an explanation',
      });
    if (
      courtSources &&
      (origin !== 'inference' ||
        (field !== 'courtName' && field !== 'courtAddress'))
    )
      ctx.addIssue({
        code: 'custom',
        path: ['courtSources'],
        message: 'Court sources require an inferred court field',
      });
  });
