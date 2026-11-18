import { z } from 'zod';

import { defineErrors } from '../../platform/errors';
import type { DocumentId, WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { Tx } from '../../platform/transactions';

export const workSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  packageVersion: z.string(),
  revision: z.number().int(),
  inputRevision: z.number().int(),
  confirmedRevision: z.number().int().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type WorkSummary = z.infer<typeof workSummarySchema>;
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

export type WorkEventKind =
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

export interface WorkDeletion {
  id: string;
  workspaceId: string;
  documentIds: string[];
  preparedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
}

export interface WorkDeletionStore {
  deletion(workspaceId: string, workId: string): Promise<WorkDeletion | null>;
  requestDeletion(
    workspaceId: string,
    workId: string,
    documentIds: string[],
    at: Date,
  ): Promise<void>;
  pendingDeletions(workspaceId?: string): Promise<WorkDeletion[]>;
  prepareDeletion(workspaceId: string, workId: string, at: Date): Promise<void>;
  failDeletion(workspaceId: string, workId: string, at: Date): Promise<void>;
  finishDeletion(workspaceId: string, workId: string, at: Date): Promise<void>;
}

export interface WorkStore extends WorkDeletionStore {
  list(workspaceId: string, input: WorkSearch): Promise<WorkListPage>;
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
  workForDocument(
    workspaceId: string,
    documentId: string,
  ): Promise<string | null>;
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

export interface WorkSearch {
  q: string;
  status: 'all' | 'draft' | 'confirmed';
  page: number;
  pageSize: number;
}

export interface WorkListPage {
  items: WorkSummary[];
  page: number;
  pageSize: number;
  total: number;
}

export interface WorksCommands {
  create(
    scope: WorkspaceScope,
    input: { title: string; packageVersion: string },
  ): Promise<WorkId>;
  attachDocument(
    scope: WorkspaceScope,
    input: { workId: WorkId; documentId: DocumentId },
  ): Promise<void>;
}

// Запросы читают данные работы. Право чтения проверяют list и events; find, sources и cursor
// внутренние: сценарий, который их вызывает, проверяет право сам.
export interface WorksQueries {
  list(scope: WorkspaceScope, input: WorkSearch): Promise<WorkListPage>;
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
    | 'get'
    | 'documents'
    | 'workForDocument'
    | 'dirty'
    | 'touch'
    | 'event'
    | 'detachDeleted'
  > &
    WorkDeletionStore;
}

// Фасад модуля: те же команды и запросы внутри транзакции через in(tx).
export interface WorksModule extends WorksPorts {
  in(tx: Tx): WorksPorts;
}
