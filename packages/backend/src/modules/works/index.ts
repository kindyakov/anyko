import type {
  DocumentPackage,
  FieldValues,
  WorkFacts,
  WorkPage,
  WorkView,
} from '@anyko/contracts';

import { defineErrors } from '../../platform/errors';
import type {
  DocumentId,
  FileId,
  GenerationId,
  WorkId,
} from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { DocumentView } from '../documents';

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
  documents(
    workspaceId: string,
    workId: string,
  ): Promise<
    {
      id: string;
      filename: string;
      sourceKey: string;
      requestKey: string;
      deleted: boolean;
    }[]
  >;
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
// Команды и запросы работы получают доверенную область первым аргументом (ADR 0009).
// Право проверяет сценарий: см. workflows/works/api.ts.
export interface WorkApi {
  packages(): DocumentPackage[];
  list(scope: WorkspaceScope, after?: string): Promise<WorkPage>;
  create(
    scope: WorkspaceScope,
    input: { title: string; packageVersion: string },
  ): Promise<WorkView>;
  get(scope: WorkspaceScope, workId: WorkId): Promise<WorkView>;
  upload(
    scope: WorkspaceScope,
    input: {
      workId: WorkId;
      filename: string;
      bytes: Uint8Array;
      correlationId: string;
      requestKey: string;
    },
  ): Promise<DocumentView>;
  removeDocument(
    scope: WorkspaceScope,
    input: { workId: WorkId; documentId: DocumentId },
  ): Promise<void>;
  source(
    scope: WorkspaceScope,
    workId: WorkId,
    documentId: DocumentId,
  ): Promise<{ bytes: Uint8Array; filename: string; contentType: string }>;
  image(
    scope: WorkspaceScope,
    workId: WorkId,
    documentId: DocumentId,
    index: number,
  ): Promise<{ bytes: Uint8Array; contentType: string }>;
  analyze(
    scope: WorkspaceScope,
    input: { workId: WorkId; correlationId: string },
  ): Promise<void>;
  edit(
    scope: WorkspaceScope,
    input: { workId: WorkId; revision: number; values: FieldValues },
  ): Promise<WorkView>;
  confirm(
    scope: WorkspaceScope,
    input: { workId: WorkId; revision: number },
  ): Promise<WorkView>;
  generate(
    scope: WorkspaceScope,
    input: { workId: WorkId; revision: number; correlationId: string },
  ): Promise<void>;
  download(
    scope: WorkspaceScope,
    workId: WorkId,
    generationId: GenerationId,
    fileId?: FileId,
  ): Promise<{ bytes: Uint8Array; filename: string }>;
  events(
    scope: WorkspaceScope,
    workId: WorkId,
    after: string,
  ): Promise<{ id: string; kind: string }[]>;
}
export type { WorkFacts };
