import { z } from 'zod';

import { fieldKeySchema, fieldValueSchema } from '../../../profiles/bfl/fields';

import type { ChatProgress } from './chat-progress';

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
export interface AgentWriteReceipt<Args, Change> {
  toolCallId: string;
  args: Args;
  change: Change;
}

export const checklistWriteTool = 'set-checklist-link';
const checklistDecision = z.enum(['confirmed', 'rejected']);
export const checklistWriteSchema = z.strictObject({
  requirementKey: z.string().min(1).max(100),
  documentId: z.uuid(),
  decision: checklistDecision,
});
export const checklistChangeSchema = checklistWriteSchema
  .omit({ decision: true })
  .extend({
    requirementLabel: z.string(),
    filename: z.string(),
    before: z.enum(['found', 'review', 'confirmed', 'rejected']).nullable(),
    after: checklistDecision,
    revision: z.number().int().nonnegative(),
  });
export type AgentChecklistWrite = z.infer<typeof checklistWriteSchema>;
export type AgentChecklistChange = z.infer<typeof checklistChangeSchema>;

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
  reasoning?: string;
  attempt?: number;
  draft?: ChatProgress;
}
export interface AgentChatStore {
  create(ref: ChatRef & { sessionId: string; userText: string }): Promise<void>;
  get(ref: ChatRef): Promise<{
    sessionId: string;
    userText: string;
    userId: string;
  } | null>;
  checkpoint(ref: ChatRef, draft: ChatProgress): Promise<boolean>;
  answer(
    ref: ChatRef,
    result: { answer: string; reasoning?: string },
  ): Promise<void>;
  context(ref: ChatSessionRef): Promise<AgentChatMessage[]>;
  timeline(
    scope: Omit<ChatRef, 'runId'>,
    page: number,
    pageSize: number,
  ): Promise<{ items: AgentTimelineEntry[]; total: number }>;
}
