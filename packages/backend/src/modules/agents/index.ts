import type { AnalysisGoal } from '../../profiles/analysis-plan';
import type {
  AnalysisDiscrepancy,
  AnalysisMissingField,
  AnalysisProposalFeedback,
} from '../../profiles/bfl/analysis-discrepancy';
import type { FieldDefinition, FieldKey } from '../../profiles/bfl/fields';

import type { AgentSessionContext, WorkFacts } from './schemas';
export type { FieldDefinition, AgentSessionContext, WorkFacts };
import type {
  ModelConnection,
  ModelTraceContext,
  ProviderCallObserver,
} from '@anyko/llm';

import type { Tx } from '../../platform/transactions';

import type {
  AgentChatMessage,
  AgentChecklistChange,
  AgentChecklistWrite,
  AgentFieldChange,
  AgentFieldWrite,
} from './application/chat';
export { checklistWriteTool, fieldWriteTool } from './application/chat';
import type { ChatDelta } from './application/chat-progress';
export {
  chatProgressSchema,
  type ChatDelta,
  type ChatProgress,
  type ChatProgressFeed,
} from './application/chat-progress';
import type { ChecklistSuggestion } from './application/checklist';
import type { AgentToolEvent } from './application/history';
export type { ChecklistSuggestion } from './application/checklist';
import type { AgentSessionStore } from './application/session';

interface AgentDocument {
  id: string;
  text: string;
  visuals: { path: string; description: string }[];
}
interface AgentUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}
export interface WorkReadContext {
  fields: FieldDefinition[];
  facts: WorkFacts;
  currentFacts?(): Promise<WorkFacts>;
  candidates: WorkFacts['candidates'];
  assertCurrent(): Promise<void>;
  readSource(documentId: string, imagePath: string | null): Promise<string>;
  traceTool?(event: AgentToolEvent): Promise<void>;
}
export type AnalysisStepInput = WorkReadContext & {
  observe?: ProviderCallObserver;
  trace?: ModelTraceContext;
  connection: ModelConnection;
  modelId: string;
  enableReasoning?: boolean;
  step: AnalysisGoal;
  sessionId: string;
  previousSummary: string | null;
  completedSteps: readonly { key: string; summary: string }[];
  review?: {
    fields: readonly FieldKey[];
    reasons: readonly AnalysisMissingField[];
    fieldInstructions: readonly {
      fields: readonly string[];
      instructions: string;
    }[];
    remainingFields(): readonly FieldKey[];
    uncoveredFields(): readonly FieldKey[];
    modelCallsUsed(): number;
    startModelCall(): Promise<void>;
    reserveRead(limit: number): Promise<boolean>;
    recordReasons(
      id: string,
      reasons: AnalysisMissingField[],
    ): Promise<string[]>;
  };
  unreadableSources?: readonly { filename: string; errorCode: string }[];
  documents: { id: string; filename: string; images: string[] }[];
  signal: AbortSignal;
  proposeFacts(
    id: string,
    proposals: { candidate: WorkFacts['candidates'][number]; index: number }[],
    statuses: string[],
    fields: readonly FieldKey[],
  ): Promise<{ statuses: string[]; feedback: AnalysisProposalFeedback[] }>;
  reportDiscrepancy(
    id: string,
    discrepancy: AnalysisDiscrepancy,
  ): Promise<string>;
};
// Bump when the visual instructions change the context passed to extraction.
export const visionPromptRevision = 4;
export const extractionPromptRevision = 8;

export interface DocumentAgents {
  runAnalysisStep?: (input: AnalysisStepInput) => Promise<{
    summary: string;
    usage: AgentUsage;
    reviewLimit?: 'model_calls' | 'reads';
  }>;
  ready(): Promise<void>;
  describe(input: {
    observe?: ProviderCallObserver;
    trace?: ModelTraceContext;
    connection: ModelConnection;
    modelId: string;
    disableReasoning?: boolean;
    resource: string;
    threadId: string;
    assertCurrent?(): Promise<void>;
    bytes: Uint8Array;
    mediaType: string;
    purpose?: 'transcription';
    signal: AbortSignal;
  }): Promise<{ description: string; usage: AgentUsage }>;
  extract(input: {
    observe?: ProviderCallObserver;
    trace?: ModelTraceContext;
    onRejectedEvidence?(
      rejections: readonly { field: FieldKey; count: number }[],
    ): void;
    fields?: FieldDefinition[];
    connection: ModelConnection;
    modelId: string;
    enableReasoning?: boolean;
    resource: string;
    threadId: string;
    assertCurrent?(): Promise<void>;
    document: AgentDocument;
    signal: AbortSignal;
  }): Promise<{ candidates: WorkFacts['candidates']; usage: AgentUsage }>;
  reconcile(input: {
    observe?: ProviderCallObserver;
    trace?: ModelTraceContext;
    traceTool?(event: AgentToolEvent): Promise<void>;
    connection: ModelConnection;
    modelId: string;
    enableReasoning?: boolean;
    resource: string;
    threadId: string;
    sessionId: string;
    checklistRequirements?: readonly {
      key: string;
      label: string;
      documentKind: string;
      applicability: 'usual' | 'conditional';
    }[];
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
    checklistSuggestions?: ChecklistSuggestion[];
    usage: AgentUsage;
  }>;
  chat(
    input: Omit<WorkReadContext, 'candidates'> & {
      observe?: ProviderCallObserver;
      trace?: ModelTraceContext;
      connection: ModelConnection;
      modelId: string;
      enableReasoning?: boolean;
      previousContext: AgentSessionContext | null;
      documents: { id: string; filename: string }[];
      listSourceImages(documentId: string): Promise<string[]>;
      messages: AgentChatMessage[];
      userText: string;
      signal: AbortSignal;
      onDelta?: (delta: ChatDelta) => void;
      appliedFields: AgentFieldChange['field'][];
      checklist?: {
        requirements: readonly { key: string; label: string }[];
        sources: { id: string; filename: string }[];
        applied: AgentChecklistChange[];
        write(
          args: AgentChecklistWrite,
          toolCallId: string,
          signal: AbortSignal,
        ): Promise<AgentChecklistChange | { errorCode: string }>;
      };
      writeField(
        args: AgentFieldWrite,
        toolCallId: string,
        signal: AbortSignal,
      ): Promise<AgentFieldChange | { errorCode: string }>;
    },
  ): Promise<{ answer: string; reasoning?: string; usage: AgentUsage }>;
  eraseThread(threadId: string): Promise<void>;
  stop(): Promise<void>;
}

// Фасад агентов: сессия работы (контекст и согласование кандидатов) для процессов. Внешние вызовы
// модели (DocumentAgents выше) идут через порт вне UnitOfWork и не входят в фасад транзакции.
export interface AgentsPorts {
  // Внутренние операции сессии: право проверяет процесс, который их вызывает.
  readonly internal: AgentSessionStore;
}
export interface AgentsModule extends AgentsPorts {
  readonly model: DocumentAgents;
  in(tx: Tx): AgentsPorts;
}
