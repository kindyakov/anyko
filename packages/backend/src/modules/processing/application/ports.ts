interface ProcessingClaim {
  runId: string;
  workspaceId: string;
  documentId: string;
  sourceKey: string;
  attemptToken: string;
  correlationId: string;
}
export interface ProcessingStore {
  stageResult: (key: string, workspaceId: string) => Promise<void>;
  orphanResults: (before: Date) => Promise<{ key: string }[]>;
  forgetResult: (key: string) => Promise<void>;
  claim: (
    runId: string,
    workspaceId: string,
    attemptToken: string,
    leaseUntil: Date,
  ) => Promise<ProcessingClaim | null>;
  complete: (
    claim: ProcessingClaim,
    resultKey: string,
    processorVersion: string,
  ) => Promise<boolean>;
  fail: (claim: ProcessingClaim, errorCode: string) => Promise<void>;
  reserveDelivery: (
    token: string,
    leaseUntil: Date,
  ) => Promise<{
    id: string;
    workspaceId: string;
    runId: string;
    token: string;
  } | null>;
  delivered: (id: string, token: string) => Promise<void>;
  releaseDelivery: (id: string, token: string) => Promise<void>;
  reconcile: () => Promise<void>;
}
