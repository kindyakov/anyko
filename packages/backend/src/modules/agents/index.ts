import type { FieldDefinition } from '../../profiles/bfl/fields';

import type { AgentSessionContext, WorkFacts } from './schemas';
export type { FieldDefinition, AgentSessionContext, WorkFacts };
import type { ModelConnection, ProviderCallObserver } from '@anyko/llm';

import type { Tx } from '../../platform/transactions';

import type { AgentChatMessage } from './application/chat';
import type { AgentToolEvent } from './application/history';
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
// Bump when the visual instructions change the context passed to extraction.
export const visionPromptRevision = 2;

export interface DocumentAgents {
  ready(): Promise<void>;
  describe(input: {
    observe?: ProviderCallObserver;
    connection: ModelConnection;
    modelId: string;
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
    fields?: FieldDefinition[];
    connection: ModelConnection;
    modelId: string;
    resource: string;
    threadId: string;
    assertCurrent?(): Promise<void>;
    document: AgentDocument;
    signal: AbortSignal;
  }): Promise<{ candidates: WorkFacts['candidates']; usage: AgentUsage }>;
  reconcile(input: {
    observe?: ProviderCallObserver;
    traceTool?(event: AgentToolEvent): Promise<void>;
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
  chat(
    input: Omit<WorkReadContext, 'candidates'> & {
      observe?: ProviderCallObserver;
      connection: ModelConnection;
      modelId: string;
      previousContext: AgentSessionContext | null;
      documents: { id: string; filename: string }[];
      listSourceImages(documentId: string): Promise<string[]>;
      messages: AgentChatMessage[];
      userText: string;
      signal: AbortSignal;
    },
  ): Promise<{ answer: string; usage: AgentUsage }>;
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
