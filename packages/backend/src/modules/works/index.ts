import type { WorkView } from '@anyko/contracts/works';

import { defineErrors } from '../../platform/errors';
import type { DocumentId, WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { Tx } from '../../platform/transactions';

export type WorkSummary = WorkView['work'];
export const WorkErrors = defineErrors({
  NOT_FOUND: 'not_found',
  FORBIDDEN: 'forbidden',
  INVALID_WORK_INPUT: 'invalid',
  REVISION_CONFLICT: 'conflict',
  WORK_BUSY: 'conflict',
  LLM_NOT_CONFIGURED: 'precondition',
  NOT_READY: 'precondition',
  CLEANUP_PENDING: 'precondition',
});
export class WorkError extends WorkErrors.Failure {}

// Виды событий работы, которые пишут сценарии этапа 5a. Процессы 5b пишут события через WorkStore.
export type WorkEventKind =
  | 'work.created'
  | 'documents.changed'
  | 'sources.deleting'
  | 'processing.queued'
  | 'facts.changed'
  | 'facts.confirmed'
  | 'generation.queued';

export interface WorkSourceRow {
  id: string;
  filename: string;
  sourceKey: string;
  requestKey: string;
  deleted: boolean;
}

export interface WorkStore {
  list(workspaceId: string, after?: string): Promise<WorkSummary[]>;
  get(workspaceId: string, workId: string): Promise<WorkSummary | null>;
  create(input: {
    id: string;
    workspaceId: string;
    title: string;
    packageVersion: string;
    actorId: string;
  }): Promise<void>;
  attach(
    workspaceId: string,
    workId: string,
    documentId: string,
  ): Promise<void>;
  documents(workspaceId: string, workId: string): Promise<WorkSourceRow[]>;
  touch(
    workspaceId: string,
    workId: string,
    input: { inputChanged?: boolean; confirmed?: boolean },
  ): Promise<void>;
  event(workspaceId: string, workId: string, kind: string): Promise<void>;
  events(
    workspaceId: string,
    workId: string,
    after: string,
  ): Promise<{ id: string; kind: string }[]>;
  cursor(workspaceId: string, workId: string): Promise<string>;
  dirty(): Promise<{ workspaceId: string; workId: string }[]>;
  detachDeleted(workspaceId: string, workId: string): Promise<void>;
}

// Durable write barrier по работе: есть ли незавершённая запись, требующая ручного восстановления.
export interface WorkIoPort {
  clean(workspaceId: string, workId: string): Promise<boolean>;
}

export interface WorkSources {
  documents: WorkSourceRow[];
  // Удалённый документ или незавершённая запись: сведения и запуски не показываются и не меняются.
  cleanupPending: boolean;
}

export interface WorkListPage {
  works: WorkSummary[];
  nextCursor: string | null;
}

// Команды меняют данные работы. Право проверяет сама команда, если она сценарий владельца;
// внутренние шаги (ревизия, событие) вызывает сценарий, который уже проверил право.
export interface WorksCommands {
  create(
    scope: WorkspaceScope,
    input: { title: string; packageVersion: string },
  ): Promise<WorkId>;
  attachDocument(
    scope: WorkspaceScope,
    input: { workId: WorkId; documentId: DocumentId },
  ): Promise<void>;
  bumpRevision(
    scope: WorkspaceScope,
    input: { workId: WorkId; confirmed: boolean },
  ): Promise<void>;
  recordEvent(
    scope: WorkspaceScope,
    input: { workId: WorkId; kind: WorkEventKind },
  ): Promise<void>;
}

// Запросы читают данные работы. Право чтения проверяют list и events; find, sources и cursor
// внутренние: сценарий, который их вызывает, проверяет право сам.
export interface WorksQueries {
  list(scope: WorkspaceScope, after?: string): Promise<WorkListPage>;
  find(scope: WorkspaceScope, workId: WorkId): Promise<WorkSummary | null>;
  sources(scope: WorkspaceScope, workId: WorkId): Promise<WorkSources>;
  cursor(scope: WorkspaceScope, workId: WorkId): Promise<string>;
  events(
    scope: WorkspaceScope,
    workId: WorkId,
    after: string,
  ): Promise<{ id: string; kind: string }[]>;
}

export interface WorksPorts {
  readonly commands: WorksCommands;
  readonly queries: WorksQueries;
  // Внутренний порт исполнения (worker и процессы после проверки права): ревизия, события, очистка.
  readonly internal: Pick<
    WorkStore,
    'get' | 'documents' | 'dirty' | 'touch' | 'event' | 'detachDeleted'
  >;
}

// Фасад модуля: те же команды и запросы внутри транзакции через in(tx).
export interface WorksModule extends WorksPorts {
  in(tx: Tx): WorksPorts;
}

export type { WorkFacts } from '@anyko/contracts/works';
