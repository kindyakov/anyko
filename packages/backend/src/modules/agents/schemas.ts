import { z } from 'zod';

import { candidateSchema } from '../../profiles/candidate';
import {
  type FieldKey,
  fieldKeySchema,
  type FieldValues,
} from '../../profiles/fields';

export interface WorkFacts {
  version: 1;
  values: FieldValues;
  manual: FieldKey[];
  confirmed: FieldKey[];
  needsReview?: FieldKey[] | undefined;
  candidates: z.infer<typeof candidateSchema>[];
}

export const agentSessionContextSchema = z
  .object({
    version: z.literal(1),
    workRevision: z.number().int().nonnegative(),
    inputRevision: z.number().int().nonnegative(),
    settingsRevision: z.number().int().positive(),
    promptVersion: z.enum(['work-context-v1', 'work-context-v2']),
    summary: z.string().max(4000),
    documents: z
      .array(z.object({ id: z.uuid(), digest: z.string().max(128) }).strict())
      .max(20),
    missingFields: z.array(fieldKeySchema),
    conflictFields: z.array(fieldKeySchema),
  })
  .strict();
export const agentSessionSchema = z
  .object({
    id: z.uuid(),
    revision: z.number().int().nonnegative(),
    context: agentSessionContextSchema.nullable(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type AgentSession = z.infer<typeof agentSessionSchema>;
export type AgentSessionContext = z.infer<typeof agentSessionContextSchema>;
