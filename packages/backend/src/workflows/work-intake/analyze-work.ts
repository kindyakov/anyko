import type { ConnectionsModule } from '../../modules/connections';
import type { ResourceLocks } from '../../modules/documents';
import type { ProcessingModule } from '../../modules/processing';
import type { WorksModule } from '../../modules/works';
import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { UnitOfWork } from '../../platform/transactions';
import { changeWork } from '../change-work';
import {
  requireAnalysisInputs,
  selectAnalysisRecovery,
  workCommandPolicy,
} from '../work-command-guards';

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
    scope.require(workCommandPolicy.analyze.right);
    await changeWork(
      deps,
      scope,
      {
        workId: input.workId,
        command: 'analyze',
        event: 'processing.queued',
      },
      async ({ work, documents }) => {
        const settings = await requireAnalysisInputs(
          deps.connections,
          scope.workspaceId,
          documents,
        );
        return async (tx) => {
          const processing = deps.processing.in(tx);
          const count = await deps.works
            .in(tx)
            .internal.pendingUploadCount(scope.workspaceId, input.workId);
          const recovery = await selectAnalysisRecovery(
            processing.internal,
            scope.workspaceId,
            input.workId,
            documents,
            count > 0,
          );
          const snapshot = {
            workId: input.workId,
            inputRevision: recovery?.inputRevision ?? work.inputRevision,
            documentIds:
              recovery?.documentIds ?? documents.map((doc) => doc.id),
            settingsRevision: settings.revision,
            correlationId: input.correlationId,
            modelSnapshot: {
              vision: settings.visionModel,
              extraction: settings.extractionModel,
            },
          };
          if (recovery?.automaticUpload)
            await processing.internal.startUploadAnalysis(
              scope.workspaceId,
              scope.userId,
              snapshot,
            );
          else
            await processing.commands.start(scope, {
              ...snapshot,
              kind: 'analysis',
              generationId: null,
            });
        };
      },
    );
  };
