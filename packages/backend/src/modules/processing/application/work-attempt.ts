import type { Clock } from '../../../platform/clock';
import type { Tx, UnitOfWork } from '../../../platform/transactions';

import { claimRunAttempt, type RunAttempt } from './run-attempt';
import type {
  StepOutput,
  WorkProcessingStore,
  WorkRunOutcome,
  WorkRunSnapshot,
  WorkStepInput,
} from './work-ports';

interface AttemptWrite {
  step(input: WorkStepInput): Promise<void>;
  finish(outcome: WorkRunOutcome): Promise<void>;
}

export interface WorkAttempt extends RunAttempt<
  WorkRunSnapshot,
  WorkRunOutcome
> {
  assertCurrent(): Promise<void>;
  analysisCheckpoint(): Promise<StepOutput | null>;
  cached(
    documentId: string,
    stage: 'vision' | 'extraction',
    sourceDigest: string,
  ): Promise<StepOutput | null>;
  step(input: WorkStepInput): Promise<void>;
  // Блокирует строку попытки до конца транзакции с записями других модулей.
  write<T>(
    apply: (tx: Tx, attempt: AttemptWrite) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T>;
}

export function claimWorkAttempt(deps: {
  store: WorkProcessingStore;
  storeFor(tx: Tx): WorkProcessingStore;
  uow: UnitOfWork;
  clock: Clock;
  newId(): string;
}) {
  const acquire = claimRunAttempt({
    ...deps,
    leaseMs: 1_800_000,
    claim: deps.store.claim,
    finish: (tx, claim, outcome: WorkRunOutcome) =>
      deps.storeFor(tx).finish(claim, outcome),
  });
  return async (
    workspaceId: string,
    runId: string,
  ): Promise<WorkAttempt | null> => {
    const acquired = await acquire(workspaceId, runId);
    if (!acquired) return null;
    const { claim, attempt } = acquired;
    return {
      ...attempt,
      assertCurrent: async () => {
        if (!(await deps.store.valid(claim)))
          throw new Error('STALE_WORK_ATTEMPT');
      },
      cached: (documentId, stage, sourceDigest) =>
        deps.store.cached(claim.snapshot, documentId, stage, sourceDigest),
      analysisCheckpoint: () => deps.store.analysisCheckpoint(claim.snapshot),
      step: (input) => deps.store.step(claim, input),
      write: (apply, signal) =>
        deps.uow.run(async (tx) => {
          const store = deps.storeFor(tx);
          await store.fence(claim);
          signal?.throwIfAborted();
          return apply(tx, {
            step: (input) => store.step(claim, input),
            finish: async (outcome) => {
              if (!(await store.finish(claim, outcome)))
                throw new Error('STALE_WORK_ATTEMPT');
            },
          });
        }, signal),
    };
  };
}
