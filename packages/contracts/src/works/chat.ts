import { z } from 'zod';

import { pageResponseSchema } from '../common';

import { workRunSchema } from './schemas';

export const workChatTimeline = pageResponseSchema(
  z.object({
    runId: z.uuid(),
    kind: z.enum(['analysis', 'chat']),
    status: workRunSchema.shape.status,
    errorCode: z.string().nullable(),
    createdAt: z.iso.datetime(),
    userText: z.string().nullable(),
    answer: z.string().nullable(),
  }),
  { canSend: z.boolean() },
);

export const workChatMessage = z.strictObject({
  userText: z.string().trim().min(1).max(6000),
});

export type WorkChatTimeline = z.infer<typeof workChatTimeline>;
