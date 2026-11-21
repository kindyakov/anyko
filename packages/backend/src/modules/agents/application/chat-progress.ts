import { z } from 'zod';

export const chatProgressSchema = z.object({
  runId: z.uuid(),
  attempt: z.number().int().positive(),
  sequence: z.number().int().positive(),
  text: z.string().max(32000),
  reasoning: z.string().max(128000),
});

export type ChatProgress = z.infer<typeof chatProgressSchema>;
export type ChatDelta = Pick<ChatProgress, 'text' | 'reasoning'>;
export interface ChatProgressFeed {
  append(
    scope: { workspaceId: string; workId: string },
    progress: ChatProgress,
  ): Promise<void>;
  read(
    scope: { workspaceId: string; workId: string },
    after: string,
  ): Promise<{ id: string; delta: ChatProgress }[]>;
  erase(scope: { workspaceId: string; workId: string }): Promise<void>;
}
