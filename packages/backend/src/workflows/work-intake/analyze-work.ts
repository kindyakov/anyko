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
