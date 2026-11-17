type IoSubject =
  | {
      kind: 'document';
      workspaceId: string;
      documentId: string;
      requestKey?: string;
    }
  | { kind: 'work'; workspaceId: string; workId: string };
export interface ProcessingIo {
  run<T>(subject: IoSubject, operation: () => Promise<T>): Promise<T>;
  clean(workspaceId: string, workId: string): Promise<boolean>;
  assertIdle(workspaceId: string, workId: string): Promise<void>;
}
