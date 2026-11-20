import { z } from 'zod';

import { fieldKeySchema, fieldValueSchema } from '../../../profiles/bfl/fields';

export const fieldWriteTool = 'set-work-field';
export const fieldWriteSchema = z.strictObject({
  field: fieldKeySchema,
  value: fieldValueSchema,
});
export const fieldChangeSchema = z.strictObject({
  field: fieldKeySchema,
  before: fieldValueSchema,
  after: fieldValueSchema,
  revision: z.number().int().positive(),
});
export type AgentFieldWrite = z.infer<typeof fieldWriteSchema>;
export type AgentFieldChange = z.infer<typeof fieldChangeSchema>;
export interface AgentFieldReceipt {
  toolCallId: string;
  args: AgentFieldWrite;
  change: AgentFieldChange;
}

type ChatRef = { workspaceId: string; workId: string; runId: string };
type ChatSessionRef = Omit<ChatRef, 'runId'> & { sessionId: string };
export interface AgentChatMessage {
  userText: string;
  answer: string;
}
interface AgentTimelineEntry {
  runId: string;
  status: string;
  errorCode: string | null;
  createdAt: string;
  kind: 'analysis' | 'chat';
  userText: string | null;
  answer: string | null;
}
export interface AgentChatStore {
  create(ref: ChatRef & { sessionId: string; userText: string }): Promise<void>;
  get(ref: ChatRef): Promise<{
    sessionId: string;
    userText: string;
    userId: string;
  } | null>;
  answer(ref: ChatRef, answer: string): Promise<void>;
  context(ref: ChatSessionRef): Promise<AgentChatMessage[]>;
  timeline(
    scope: Omit<ChatRef, 'runId'>,
    page: number,
    pageSize: number,
  ): Promise<{ items: AgentTimelineEntry[]; total: number }>;
}
