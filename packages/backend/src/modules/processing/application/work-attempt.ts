import type { Tx, UnitOfWork } from '../../../platform/transactions';

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

export interface WorkAttempt {
  readonly run: WorkRunSnapshot;
  assertCurrent(): Promise<void>;
  cached(
    documentId: string,
    stage: 'vision' | 'extraction',
    sourceDigest: string,
  ): Promise<StepOutput | null>;
  step(input: WorkStepInput): Promise<void>;
  // Блокирует строку попытки до конца транзакции с записями других модулей.
  write<T>(apply: (tx: Tx, attempt: AttemptWrite) => Promise<T>): Promise<T>;
  // При отказе активность проверяется до обновления производных данных.
  finish(
    outcome: WorkRunOutcome,
    onAccepted: (tx: Tx) => Promise<void>,
  ): Promise<boolean>;
}

export const claimWorkAttempt =
  (deps: {
    store: WorkProcessingStore;
    storeFor(tx: Tx): WorkProcessingStore;
    uow: UnitOfWork;
  }) =>
  async (workspaceId: string, runId: string): Promise<WorkAttempt | null> => {
    const claim = await deps.store.claim(workspaceId, runId);
    if (!claim) return null;
    return {
      run: claim.snapshot,
      assertCurrent: async () => {
        if (!(await deps.store.valid(claim)))
          throw new Error('STALE_WORK_ATTEMPT');
      },
      cached: (documentId, stage, sourceDigest) =>
        deps.store.cached(claim.snapshot, documentId, stage, sourceDigest),
      step: (input) => deps.store.step(claim, input),
      write: (apply) =>
        deps.uow.run(async (tx) => {
          const store = deps.storeFor(tx);
          await store.fence(claim);
          return apply(tx, {
            step: (input) => store.step(claim, input),
            finish: async (outcome) => {
              if (!(await store.finish(claim, outcome)))
                throw new Error('STALE_WORK_ATTEMPT');
            },
          });
        }),
      finish: (outcome, onAccepted) =>
        deps.uow.run(async (tx) => {
          if (!(await deps.storeFor(tx).finish(claim, outcome))) return false;
          await onAccepted(tx);
          return true;
        }),
    };
  };
