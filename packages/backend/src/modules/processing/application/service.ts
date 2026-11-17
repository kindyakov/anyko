import type { Clock } from '../../../platform/clock';

import type { ProcessingStore } from './ports';

export function createProcessingService(
  store: ProcessingStore,
  deps: { clock: Clock; newId(): string },
) {
  return {
    attemptIds: store.attemptIds,
    documentId: store.documentId,
    resultKeys: store.resultKeys,
    stageResult: store.stageResult,
    orphanResults: store.orphanResults,
    forgetResult: store.forgetResult,
    claim(runId: string, workspaceId: string, leaseMs: number) {
      return store.claim(
        runId,
        workspaceId,
        deps.newId(),
        new Date(deps.clock.now().getTime() + leaseMs),
      );
    },
    complete: store.complete,
    fail: store.fail,
    reserveDelivery() {
      return store.reserveDelivery(
        deps.newId(),
        new Date(deps.clock.now().getTime() + 30000),
      );
    },
    delivered: store.delivered,
    releaseDelivery: store.releaseDelivery,
    reconcile: store.reconcile,
  };
}
