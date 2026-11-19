import type { WorkRunStart } from '..';

import type { WorkProcessingStore } from './work-ports';

// Постановка запуска в очередь: строка запуска и исходящее сообщение в одной транзакции (вызывает сценарий).
export const startRun =
  (deps: { store: WorkProcessingStore; newId: () => string }) =>
  async (
    scope: { workspaceId: string; userId: string },
    input: WorkRunStart,
    automaticUpload = false,
  ) => {
    await deps.store.start({
      id: deps.newId(),
      workspaceId: scope.workspaceId,
      workId: input.workId,
      kind: input.kind,
      inputRevision: input.inputRevision,
      automaticUpload,
      documentIds: input.documentIds,
      settingsRevision: input.settingsRevision,
      generationId: input.generationId,
      correlationId: input.correlationId,
      actorId: scope.userId,
      modelSnapshot: input.modelSnapshot,
    });
  };
