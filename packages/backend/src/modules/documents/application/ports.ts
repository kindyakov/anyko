import type { SourceFormat } from './source-format';

type DocumentStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export interface DocumentView {
  id: string;
  filename: string;
  status: DocumentStatus;
  createdAt: string;
  errorCode: string | null;
}
export interface DocumentResult {
  markdown: string;
  processorVersion: string;
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
  ): Promise<T>;
}
export interface DocumentIo {
  run<T>(
    input: { workspaceId: string; documentId: string; requestKey?: string },
    operation: () => Promise<T>,
  ): Promise<T>;
}
export class StorageWriteOutcomeUnknown extends Error {
  constructor() {
    super('STORAGE_WRITE_OUTCOME_UNKNOWN');
  }
}
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
  ): Promise<DocumentResult>;
  eraseAttempt(attemptId: string): Promise<void>;
}
export interface DocumentStore {
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
  list(workspaceId: string): Promise<DocumentView[]>;
  pendingDeletions(workspaceId: string): Promise<
    {
      id: string;
      createdAt: string;
      status: 'deleting' | 'needs-recovery';
    }[]
  >;
  get(workspaceId: string, documentId: string): Promise<DocumentView | null>;
  resultKey(workspaceId: string, documentId: string): Promise<string | null>;
  remove(workspaceId: string, documentId: string): Promise<boolean>;
  deletion(
    workspaceId: string,
    documentId: string,
  ): Promise<'deleting' | 'deleted' | 'needs-recovery' | null>;
  image(
    workspaceId: string,
    documentId: string,
    index: number,
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
  ): Promise<DocumentView | null>;
}
