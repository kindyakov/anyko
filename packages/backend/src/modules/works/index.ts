import type {
  DocumentPackage,
  FieldValues,
  WorkFacts,
  WorkPage,
  WorkView,
} from '@anyko/contracts';

import { defineErrors } from '../../platform/errors';
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
export interface WorkApi {
  removeDocument(input: {
    workspaceId: string;
    workId: string;
    documentId: string;
  }): Promise<void>;
  packages(): DocumentPackage[];
  list(workspaceId: string, after?: string): Promise<WorkPage>;
  create(input: {
    workspaceId: string;
    actorId: string;
    title: string;
    packageVersion: string;
  }): Promise<WorkView>;
  get(workspaceId: string, workId: string): Promise<WorkView>;
  upload(input: {
    workspaceId: string;
    workId: string;
    actorId: string;
    filename: string;
    bytes: Uint8Array;
    correlationId: string;
    requestKey: string;
  }): Promise<DocumentView>;
  analyze(input: {
    workspaceId: string;
    workId: string;
    actorId: string;
    correlationId: string;
  }): Promise<void>;
  edit(input: {
    workspaceId: string;
    workId: string;
    revision: number;
    values: FieldValues;
  }): Promise<WorkView>;
  confirm(input: {
    workspaceId: string;
    workId: string;
    revision: number;
  }): Promise<WorkView>;
  generate(input: {
    workspaceId: string;
    workId: string;
    revision: number;
    actorId: string;
    correlationId: string;
  }): Promise<void>;
  download(
    workspaceId: string,
    workId: string,
    generationId: string,
    fileId?: string,
  ): Promise<{ bytes: Uint8Array; filename: string }>;
  events(
    workspaceId: string,
    workId: string,
    after: string,
  ): Promise<{ id: string; kind: string }[]>;
}
export type { WorkFacts };
