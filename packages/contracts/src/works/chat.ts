import { z } from 'zod';

import { pageResponseSchema } from '../common';

import { workRunSchema } from './schemas';

export const chatProgress = z.object({
  runId: z.uuid(),
  attempt: z.number().int().positive(),
  sequence: z.number().int().positive(),
  text: z.string().max(32000),
  reasoning: z.string().max(128000),
});
export type ChatProgress = z.infer<typeof chatProgress>;

export const workChatTimeline = pageResponseSchema(
  z.object({
    runId: z.uuid(),
    kind: z.enum(['analysis', 'chat']),
    status: workRunSchema.shape.status,
    errorCode: z.string().nullable(),
    createdAt: z.iso.datetime(),
    userText: z.string().nullable(),
    answer: z.string().nullable(),
    reasoning: z.string().optional(),
    attempt: z.number().int().positive().optional(),
    draft: chatProgress.optional(),
  }),
  { canSend: z.boolean() },
);

export const workChatMessage = z.strictObject({
  userText: z.string().trim().min(1).max(6000),
});

export type WorkChatTimeline = z.infer<typeof workChatTimeline>;
