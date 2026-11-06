import type { ModelConnection } from '@anyko/llm';
import type {
  WorkFacts,
  FieldDefinition,
  AgentSessionContext,
} from '@anyko/contracts';

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
    fields?: FieldDefinition[];
    connection: ModelConnection;
    modelId: string;
    resource: string;
    threadId: string;
    document: AgentDocument;
    signal: AbortSignal;
  }): Promise<{ candidates: WorkFacts['candidates']; usage: AgentUsage }>;
  reconcile(input: {
    connection: ModelConnection;
    modelId: string;
    resource: string;
    threadId: string;
    sessionId: string;
    workRevision: number;
    previousContext: AgentSessionContext | null;
    fields: FieldDefinition[];
    facts: WorkFacts;
    candidates: WorkFacts['candidates'];
    documents: {
      id: string;
      filename: string;
      digest: string;
      images: string[];
    }[];
    signal: AbortSignal;
    assertCurrent(): Promise<void>;
    readSource(documentId: string, imagePath: string | null): Promise<string>;
  }): Promise<{
    summary: string;
    candidates: WorkFacts['candidates'];
    usage: AgentUsage;
  }>;
  eraseThread(threadId: string): Promise<void>;
  stop(): Promise<void>;
}

export { combineCandidates, selectSessionCandidates } from './session';
export type { AgentSessionStore } from './session';
