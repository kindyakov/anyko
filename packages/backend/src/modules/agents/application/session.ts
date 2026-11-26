import { z } from 'zod';

import { candidateSchema } from '../../../profiles/candidate';
import type { AgentSession, AgentSessionContext } from '../schemas';

import type { AgentChatStore } from './chat';
import type { AgentHistoryStore } from './history';

export const reconciliationSchema = z
  .object({
    summary: z.string().min(1).max(4000),
    candidates: z.array(candidateSchema).max(500),
  })
  .strict();
type Reconciliation = z.infer<typeof reconciliationSchema>;
export interface AgentSessionStore {
  history: AgentHistoryStore;
  chat: AgentChatStore;
  get(workspaceId: string, workId: string): Promise<AgentSession | null>;
  ensure(workspaceId: string, workId: string): Promise<AgentSession>;
  accept(input: {
    workspaceId: string;
    workId: string;
    sessionId: string;
    expectedRevision: number;
    runId: string;
    threadId: string;
    context: AgentSessionContext;
    output: Reconciliation;
  }): Promise<void>;
  erase(workspaceId: string, workId: string): Promise<void>;
}
