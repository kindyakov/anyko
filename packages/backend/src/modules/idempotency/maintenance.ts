import type { Clock } from '../../platform/clock';

export interface IdempotencyMaintenanceStore {
  deleteExpired(now: Date, batchSize: number): Promise<number>;
}
/** Global internal port: no fabricated workspace or user authority. */
export function createIdempotencyMaintenance(deps: {
  store: IdempotencyMaintenanceStore;
  clock: Clock;
}) {
  return {
    internal: {
      async cleanup(signal: AbortSignal) {
        const now = deps.clock.now();
        for (let batch = 0; batch < 20; batch++) {
          signal.throwIfAborted();
          if ((await deps.store.deleteExpired(now, 100)) < 100) break;
        }
      },
    },
  };
}
