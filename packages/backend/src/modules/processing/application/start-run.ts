import type { WorkProcessingStore, WorkRunStart } from '..';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

// Постановка запуска в очередь: строка запуска и исходящее сообщение в одной транзакции (вызывает сценарий).
export const startRun =
  (deps: { store: WorkProcessingStore; newId: () => string }) =>
  async (scope: WorkspaceScope, input: WorkRunStart) => {
    await deps.store.start({
      id: deps.newId(),
      workspaceId: scope.workspaceId,
      workId: input.workId,
      kind: input.kind,
      inputRevision: input.inputRevision,
      documentIds: input.documentIds,
      settingsRevision: input.settingsRevision,
      generationId: input.generationId,
      correlationId: input.correlationId,
      attemptToken: null,
      actorId: scope.userId,
      modelSnapshot: input.modelSnapshot,
    });
  };
