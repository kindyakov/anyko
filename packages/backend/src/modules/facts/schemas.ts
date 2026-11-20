import { z } from 'zod';

import { candidateSchema } from '../../profiles/bfl/candidate';
import {
  fieldKeySchema,
  fieldValuesSchema,
  readFieldValues,
} from '../../profiles/bfl/fields';

export const factsSchema = z
  .object({
    version: z.literal(1),
    values: z.preprocess(
      (input) =>
        typeof input === 'object' && input !== null && !Array.isArray(input)
          ? { ...readFieldValues({}), ...input }
          : input,
      fieldValuesSchema,
    ),
    manual: z.array(fieldKeySchema),
    confirmed: z.array(fieldKeySchema).default([]),
    needsReview: z.array(fieldKeySchema).optional(),
    candidates: z.array(candidateSchema).max(500),
  })
  .strict();
export type WorkFacts = z.infer<typeof factsSchema>;
