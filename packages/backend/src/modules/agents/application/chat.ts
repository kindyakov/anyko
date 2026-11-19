type ChatRef = { workspaceId: string; workId: string; runId: string };
type ChatSessionRef = Omit<ChatRef, 'runId'> & { sessionId: string };
export interface AgentChatMessage {
  userText: string;
  answer: string;
}
export interface AgentTimelineEntry {
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
  get(ref: ChatRef): Promise<{ sessionId: string; userText: string } | null>;
  answer(ref: ChatRef, answer: string): Promise<void>;
  context(ref: ChatSessionRef): Promise<AgentChatMessage[]>;
  timeline(
    scope: Omit<ChatRef, 'runId'>,
    page: number,
    pageSize: number,
  ): Promise<{ items: AgentTimelineEntry[]; total: number }>;
}
