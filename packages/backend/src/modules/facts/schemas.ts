import { z } from 'zod';

import { candidateSchema } from '../../profiles/candidate';
import { fieldKeySchema, storedFieldValuesSchema } from '../../profiles/fields';

export const factsSchema = z
  .object({
    version: z.literal(1),
    values: storedFieldValuesSchema,
    manual: z.array(fieldKeySchema),
    confirmed: z.array(fieldKeySchema).default([]),
    needsReview: z.array(fieldKeySchema).optional(),
    candidates: z.array(candidateSchema).max(500),
  })
  .strict();
export type WorkFacts = z.infer<typeof factsSchema>;
