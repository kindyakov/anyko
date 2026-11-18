import type { Clock } from '../../../platform/clock';
import type { Tx, UnitOfWork } from '../../../platform/transactions';

export interface RunClaim<Snapshot> {
  snapshot: Snapshot;
  attemptToken: string;
}

export interface RunAttempt<Snapshot, Outcome> {
  readonly run: Snapshot;
  finish(
    outcome: Outcome,
    onAccepted?: (tx: Tx) => Promise<void>,
  ): Promise<boolean>;
}

export const claimRunAttempt =
  <Snapshot, Outcome>(deps: {
    uow: UnitOfWork;
    clock: Clock;
    newId(): string;
    leaseMs: number;
    claim(
      workspaceId: string,
      runId: string,
      attemptToken: string,
      leaseUntil: Date,
    ): Promise<RunClaim<Snapshot> | null>;
    finish(
      tx: Tx,
      claim: RunClaim<Snapshot>,
      outcome: Outcome,
    ): Promise<boolean>;
  }) =>
  async (workspaceId: string, runId: string) => {
    const attemptToken = deps.newId();
    const leaseUntil = new Date(deps.clock.now().getTime() + deps.leaseMs);
    const claim = await deps.claim(
      workspaceId,
      runId,
      attemptToken,
      leaseUntil,
    );
    if (!claim) return null;
    const attempt: RunAttempt<Snapshot, Outcome> = {
      run: claim.snapshot,
      finish: (outcome, onAccepted) =>
        deps.uow.run(async (tx) => {
          if (!(await deps.finish(tx, claim, outcome))) return false;
          await onAccepted?.(tx);
          return true;
        }),
    };
    return { claim, attempt };
  };
