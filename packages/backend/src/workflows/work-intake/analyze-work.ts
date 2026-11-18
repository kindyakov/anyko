import type { ConnectionsModule } from '../../modules/connections';
import type { ResourceLocks } from '../../modules/documents';
import type { ProcessingModule } from '../../modules/processing';
import { WorkError, type WorksModule } from '../../modules/works';
import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { UnitOfWork } from '../../platform/transactions';
import { changeWork } from '../change-work';

// Запуск анализа: снимок модели и ревизии входа ставится в очередь в одной транзакции с событием.
export const analyzeWork =
  (deps: {
    uow: UnitOfWork;
    works: WorksModule;
    processing: ProcessingModule;
    connections: ConnectionsModule;
    locks: ResourceLocks;
  }) =>
  async (
    scope: WorkspaceScope,
    input: { workId: WorkId; correlationId: string },
  ) => {
    scope.require('works.edit');
    await changeWork(
      deps,
      scope,
      { workId: input.workId, requireIdle: true, event: 'processing.queued' },
      async ({ work, documents }) => {
        if (!documents.length) throw new WorkError('INVALID_WORK_INPUT');
        const settings = await deps.connections.internal.configuration(
          scope.workspaceId,
        );
        if (!settings) throw new WorkError('LLM_NOT_CONFIGURED');
        return (tx) =>
          deps.processing.in(tx).commands.start(scope, {
            workId: input.workId,
            kind: 'analysis',
            inputRevision: work.inputRevision,
            documentIds: documents.map((doc) => doc.id),
            settingsRevision: settings.revision,
            generationId: null,
            correlationId: input.correlationId,
            modelSnapshot: {
              vision: settings.visionModel,
              extraction: settings.extractionModel,
            },
          });
      },
    );
  };
