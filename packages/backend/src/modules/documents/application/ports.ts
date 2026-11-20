import type { z } from 'zod';

import type { Logger } from '@anyko/logger';

import type { ProcessingIo } from '../../processing';

import type { pdfOcrSchema } from './result-schema';
import type { SourceFormat } from './source-format';

type DocumentStatus = 'queued' | 'running' | 'succeeded' | 'failed';
type LinkedWork = { id: string; title: string };
export interface DocumentView {
  id: string;
  filename: string;
  status: DocumentStatus;
  createdAt: string;
  errorCode: string | null;
  processingRevision?: number;
  readyRevision?: number | null;
  linkedWorks?: LinkedWork[];
}
export interface DocumentDeletionImpact {
  token: string;
  works: { id: string; title: string; busy: boolean }[];
}

export interface DocumentDeletionConfirmation {
  token?: string | undefined;
  canDeleteLinked: boolean;
}

export interface DocumentResult {
  markdown: string;
  processorVersion: string;
  pdfOcr?: z.infer<typeof pdfOcrSchema>;
  images?: { path: string; contentType: string; bytes: Uint8Array }[];
}
interface Artifact {
  key: string;
  workspaceId: string;
  documentId: string;
  requestKey?: string;
  manifestKey?: string;
  kind: 'source' | 'result' | 'image';
  position?: number;
  path?: string;
  contentType: string;
  size: number;
  checksum: string;
}
export interface ArtifactRegistry {
  stage: (artifact: Artifact) => Promise<void>;
  forget: (key: string) => Promise<void>;
}
export interface ResourceLocks {
  run<T>(
    key: string,
    operation: (signal: AbortSignal) => Promise<T>,
    parentSignal?: AbortSignal,
  ): Promise<T>;
}
export { StorageWriteOutcomeUnknown } from '../../../platform/storage-write-outcome';
export interface SourceStorage {
  put(
    key: string,
    bytes: Uint8Array,
    contentType: string,
    signal?: AbortSignal,
  ): Promise<void>;
  get(key: string, signal?: AbortSignal): Promise<Uint8Array>;
  delete(key: string, signal?: AbortSignal): Promise<void>;
  exists(key: string): Promise<boolean>;
  ready?: () => Promise<void>;
}
export interface DocumentParser {
  parseDocument(
    bytes: Uint8Array,
    format: SourceFormat,
    attemptId: string,
    mode?: 'visual-inputs',
  ): Promise<DocumentResult>;
  eraseAttempt(attemptId: string): Promise<void>;
}
export interface DocumentPosition {
  createdAt: Date;
  id: string;
}

interface DocumentListFilters {
  checksum?: string | undefined;
  q?: string | undefined;
  formats?: readonly SourceFormat[] | undefined;
}

export interface DocumentListInput extends DocumentListFilters {
  after?: string | undefined;
  limit: number;
}

export interface DocumentPage {
  items: DocumentView[];
  nextCursor: string | null;
}

export interface DocumentStore {
  source(
    workspaceId: string,
    documentId: string,
  ): Promise<{
    key: string;
    size: number;
    checksum: string;
    filename: string;
  } | null>;
  stageSource(key: string, workspaceId: string): Promise<void>;
  forgetSource(key: string): Promise<void>;
  register(input: {
    id: string;
    runId: string;
    workspaceId: string;
    filename: string;
    sourceKey: string;
    sourceChecksum: string;
    size: number;
    actorId: string;
    correlationId: string;
    requestKey: string;
  }): Promise<DocumentView>;
  list(
    workspaceId: string,
    input: DocumentListFilters & { limit: number; after?: DocumentPosition },
  ): Promise<DocumentView[]>;
  linkedWorks(
    workspaceId: string,
    documentIds: string[],
  ): Promise<Map<string, LinkedWork[]>>;
  pendingDeletions(workspaceId: string): Promise<
    {
      id: string;
      createdAt: string;
      status: 'deleting' | 'needs-recovery';
    }[]
  >;
  get(
    workspaceId: string,
    documentId: string,
    revision?: number | null,
  ): Promise<DocumentView | null>;
  readyResult(
    workspaceId: string,
    documentId: string,
    revision?: number | null,
  ): Promise<{ resultKey: string; revision: number } | null>;
  // Инициатор нужен журналу: удаление и событие записываются в одной транзакции.
  remove(
    workspaceId: string,
    documentId: string,
    actorId: string,
    confirmation?: DocumentDeletionConfirmation,
  ): Promise<boolean>;
  deletionImpact(
    workspaceId: string,
    documentId: string,
  ): Promise<DocumentDeletionImpact | null>;
  deletion(
    workspaceId: string,
    documentId: string,
  ): Promise<'deleting' | 'deleted' | 'needs-recovery' | null>;
  image(
    workspaceId: string,
    documentId: string,
    index: number,
    revision?: number | null,
  ): Promise<{
    key: string;
    contentType: string;
    size: number;
    checksum: string;
  } | null>;
  assertUploadAllowed(workspaceId: string, requestKey: string): Promise<void>;
  retry(
    workspaceId: string,
    documentId: string,
    actorId: string,
    correlationId: string,
    replaceSucceeded?: boolean,
  ): Promise<DocumentView | null>;
}

// Зависимости команд и запросов модуля: часы не нужны (даты приходят из хранилища), ID — генератор.
export interface DocumentDeps {
  store: DocumentStore;
  storage: SourceStorage;
  artifacts: ArtifactRegistry;
  locks: ResourceLocks;
  io: Pick<ProcessingIo, 'run'>;
  logger: Logger;
  newId: () => string;
}
