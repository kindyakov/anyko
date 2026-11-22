import { z } from 'zod';

import { fieldKeySchema, fieldValueSchema } from '../catalog';
import { pageResponseSchema } from '../common';

import { workRunSchema } from './schemas';

export const agentHistoryRunPage = pageResponseSchema(
  workRunSchema.pick({ id: true, status: true, createdAt: true }),
  {},
);
export type AgentHistoryRunPage = z.infer<typeof agentHistoryRunPage>;
const count = z.number().int().nonnegative();
const tokens = count.nullable();
const usage = z.object({
  calls: count,
  inputTokens: tokens,
  outputTokens: tokens,
  cachedInputTokens: tokens,
  reasoningTokens: tokens,
  unknownInputCalls: count,
  unknownOutputCalls: count,
});
const agentHistoryEvent = z.object({
  id: z.uuid(),
  interactionId: z.uuid(),
  documentId: z.uuid().nullable(),
  stage: z.string(),
  kind: z.string(),
  status: z.string(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  inputTokens: tokens,
  outputTokens: tokens,
  cachedInputTokens: tokens,
  reasoningTokens: tokens,
  input: z.string().nullable(),
  output: z.string().nullable(),
  errorCode: z.string().nullable(),
  durationMs: count.nullable(),
  createdAt: z.iso.datetime(),
  fieldChange: z
    .object({
      field: fieldKeySchema,
      before: fieldValueSchema,
      after: fieldValueSchema,
      revision: z.number().int().nonnegative(),
    })
    .nullable(),
  checklistChange: z
    .object({
      requirementKey: z.string(),
      requirementLabel: z.string(),
      documentId: z.uuid(),
      filename: z.string(),
      before: z.enum(['found', 'review', 'confirmed', 'rejected']).nullable(),
      after: z.enum(['confirmed', 'rejected']),
      revision: count,
    })
    .nullable(),
});
export const agentHistoryPage = pageResponseSchema(agentHistoryEvent, {
  runUsage: usage,
  workUsage: usage,
  steps: z.array(
    z.object({
      stage: z.string(),
      documentId: z.uuid().nullable(),
      usage,
    }),
  ),
});
export type AgentHistoryPage = z.infer<typeof agentHistoryPage>;
