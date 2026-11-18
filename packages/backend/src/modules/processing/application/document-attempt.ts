import type { Clock } from '../../../platform/clock';
import type { UnitOfWork } from '../../../platform/transactions';

import type {
  DocumentAttemptStore,
  DocumentRunOutcome,
  DocumentRunSnapshot,
} from './ports';
import { claimRunAttempt, type RunAttempt } from './run-attempt';

export const documentOcrPolicy = {
  name: 'document.ocr',
  maxRunAttempts: 3,
  redeliverQueued: true,
} as const;

export interface DocumentAttempt extends RunAttempt<
  DocumentRunSnapshot,
  DocumentRunOutcome
> {
  readonly attemptId: string;
}

export function claimDocumentAttempt(deps: {
  store: DocumentAttemptStore;
  clock: Clock;
  uow: UnitOfWork;
  newId(): string;
  leaseMs: number;
}) {
  const acquire = claimRunAttempt({
    ...deps,
    claim: deps.store.claim,
    finish: deps.store.finish,
  });
  return async (
    workspaceId: string,
    runId: string,
  ): Promise<DocumentAttempt | null> => {
    const acquired = await acquire(workspaceId, runId);
    if (!acquired) return null;
    return { ...acquired.attempt, attemptId: acquired.claim.attemptToken };
  };
}
