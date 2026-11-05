import type { ModelConnection } from '@anyko/llm';
import type { WorkFacts } from '@anyko/contracts';

interface AgentDocument {
  id: string;
  text: string;
  visuals: { path: string; description: string }[];
}
interface AgentUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}
export interface DocumentAgents {
  ready(): Promise<void>;
  describe(input: {
    connection: ModelConnection;
    modelId: string;
    resource: string;
    threadId: string;
    bytes: Uint8Array;
    mediaType: string;
    signal: AbortSignal;
  }): Promise<{ description: string; usage: AgentUsage }>;
  extract(input: {
    connection: ModelConnection;
    modelId: string;
    resource: string;
    threadId: string;
    document: AgentDocument;
    signal: AbortSignal;
  }): Promise<{ candidates: WorkFacts['candidates']; usage: AgentUsage }>;
  eraseThread(threadId: string): Promise<void>;
  stop(): Promise<void>;
}
