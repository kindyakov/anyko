import type { ProcessingStore } from './ports';
export function createProcessingService(store: ProcessingStore) {
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
        crypto.randomUUID(),
        new Date(Date.now() + leaseMs),
      );
    },
    complete: store.complete,
    fail: store.fail,
    reserveDelivery() {
      return store.reserveDelivery(
        crypto.randomUUID(),
        new Date(Date.now() + 30000),
      );
    },
    delivered: store.delivered,
    releaseDelivery: store.releaseDelivery,
    reconcile: store.reconcile,
  };
}
