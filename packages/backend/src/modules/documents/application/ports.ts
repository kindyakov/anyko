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
}
export interface SourceStorage {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}
export interface DocumentParser {
  parsePdf(bytes: Uint8Array): Promise<DocumentResult>;
}
export interface DocumentStore {
  stageSource(key: string, workspaceId: string): Promise<void>;
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
  get(workspaceId: string, documentId: string): Promise<DocumentView | null>;
  resultKey(workspaceId: string, documentId: string): Promise<string | null>;
  retry(
    workspaceId: string,
    documentId: string,
    actorId: string,
    correlationId: string,
  ): Promise<DocumentView | null>;
}
