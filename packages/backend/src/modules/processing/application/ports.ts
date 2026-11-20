import type { Tx } from '../../../platform/transactions';

import type { RunClaim } from './run-attempt';

export interface DocumentRunSnapshot {
  id: string;
  attempts: number;
  workspaceId: string;
  documentId: string;
  sourceKey: string;
  correlationId: string;
}
export type DocumentRunOutcome =
  | { status: 'succeeded'; resultKey: string; processorVersion: string }
  | { status: 'failed'; errorCode: string };

export interface DocumentArtifacts {
  attemptIds: (workspaceId: string, documentId: string) => Promise<string[]>;
  documentId: (workspaceId: string, runId: string) => Promise<string | null>;
  resultKeys: (workspaceId: string, documentId: string) => Promise<string[]>;
  stageResult: (key: string, workspaceId: string) => Promise<void>;
  orphanResults: (before: Date) => Promise<{ key: string }[]>;
  forgetResult: (key: string) => Promise<void>;
}

export interface DocumentAttemptStore {
  claim: (
    workspaceId: string,
    runId: string,
    attemptToken: string,
    leaseUntil: Date,
  ) => Promise<RunClaim<DocumentRunSnapshot> | null>;
  finish: (
    tx: Tx,
    claim: RunClaim<DocumentRunSnapshot>,
    outcome: DocumentRunOutcome,
  ) => Promise<boolean>;
}
