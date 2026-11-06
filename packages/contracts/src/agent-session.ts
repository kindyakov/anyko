import { z } from 'zod';
import { fieldKeySchema } from './work-fields';

export const agentSessionContextSchema = z
  .object({
    version: z.literal(1),
    workRevision: z.number().int().nonnegative(),
    inputRevision: z.number().int().nonnegative(),
    settingsRevision: z.number().int().positive(),
    promptVersion: z.literal('work-context-v1'),
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
export type AgentSessionContext = z.infer<typeof agentSessionContextSchema>;
export type AgentSession = z.infer<typeof agentSessionSchema>;
