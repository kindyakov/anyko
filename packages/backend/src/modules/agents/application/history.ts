import type { ProviderCallObserver } from '@anyko/llm';

import type {
  AgentChecklistChange,
  AgentChecklistWrite,
  AgentFieldChange,
  AgentFieldWrite,
  AgentWriteReceipt,
} from './chat';

type AgentStage = 'vision' | 'extraction' | 'reconciliation' | 'chat';
interface AgentRunRef {
  workspaceId: string;
  workId: string;
  runId: string;
}
interface AgentInteraction {
  interactionId: string;
  stage: AgentStage;
  documentId?: string;
}
type AgentRunHistory = {
  observe(
    input: AgentInteraction & {
      provider: string;
      model: string;
      imagePath?: string;
    },
  ): ProviderCallObserver;
  tool(input: AgentInteraction & AgentToolEvent): Promise<void>;
};

export interface AgentToolEvent {
  input: string;
  output: string | null;
  status: 'succeeded' | 'failed';
  errorCode?: string;
}

type AgentHistoryRef = AgentRunRef & { sessionId: string };
type AgentDecision = AgentInteraction & {
  status: 'accepted' | 'rejected' | 'superseded';
  output: string | null;
  errorCode?: string;
};
interface UsageSummary {
  calls: number;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedInputTokens: number | null;
  reasoningTokens: number | null;
  unknownInputCalls: number;
  unknownOutputCalls: number;
}
interface HistoryPage {
  items: {
    id: string;
    interactionId: string;
    documentId: string | null;
    stage: string;
    kind: string;
    status: string;
    provider: string | null;
    model: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
    cachedInputTokens: number | null;
    reasoningTokens: number | null;
    input: string | null;
    output: string | null;
    errorCode: string | null;
    fieldChange: AgentFieldChange | null;
    checklistChange: AgentChecklistChange | null;
    durationMs: number | null;
    createdAt: string;
  }[];
  total: number;
  page: number;
  pageSize: number;
  runUsage: UsageSummary;
  workUsage: UsageSummary;
  steps: { stage: string; documentId: string | null; usage: UsageSummary }[];
}
export interface AgentHistoryStore {
  record(ref: AgentHistoryRef): AgentRunHistory;
  outcome(ref: AgentHistoryRef, outcome: AgentDecision): Promise<void>;
  fieldChange(
    ref: AgentRunRef & { eventId: string },
  ): Promise<AgentFieldChange | null>;
  fieldWrites(
    ref: AgentHistoryRef,
  ): Promise<AgentWriteReceipt<AgentFieldWrite, AgentFieldChange>[]>;
  checklistWrites(
    ref: AgentHistoryRef,
  ): Promise<AgentWriteReceipt<AgentChecklistWrite, AgentChecklistChange>[]>;
  read(
    ref: AgentRunRef,
    page: number,
    pageSize: number,
  ): Promise<HistoryPage | null>;
  runs(
    scope: Omit<AgentRunRef, 'runId'>,
    page: number,
    pageSize: number,
  ): Promise<{
    items: { id: string; status: string; createdAt: string }[];
    total: number;
    page: number;
    pageSize: number;
  }>;
}
