import type { ResourceLocks } from '../../modules/documents';
import type { ProcessingModule } from '../../modules/processing';
import { WorkError, type WorksModule } from '../../modules/works';
import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { UnitOfWork } from '../../platform/transactions';
import {
  requireCleanSources,
  requireIdle,
  requireWork,
  workLockKey,
} from '../work-guards';

// Запуск анализа: снимок модели и ревизии входа ставится в очередь в одной транзакции с событием.
export const analyzeWork =
  (deps: {
    uow: UnitOfWork;
    works: WorksModule;
    processing: ProcessingModule;
    locks: ResourceLocks;
  }) =>
  async (
    scope: WorkspaceScope,
    input: { workId: WorkId; correlationId: string },
  ) => {
    scope.require('works.edit');
    await deps.locks.run(
      workLockKey(scope.workspaceId, input.workId),
      async () => {
        const work = await requireWork(deps.works.queries, scope, input.workId);
        const documents = await requireCleanSources(
          deps.works.queries,
          scope,
          input.workId,
        );
        if (!documents.length) throw new WorkError('INVALID_WORK_INPUT');
        const settings = await deps.processing.queries.llmConfiguration(scope);
        if (!settings) throw new WorkError('LLM_NOT_CONFIGURED');
        await requireIdle(deps.processing.queries, scope, input.workId);
        await deps.uow.run(async (tx) => {
          await deps.processing.in(tx).commands.start(scope, {
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
          await deps.works.in(tx).commands.recordEvent(scope, {
            workId: input.workId,
            kind: 'processing.queued',
          });
        });
      },
    );
  };
