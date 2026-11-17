import type { AuditModule } from '../../modules/audit';
import type { ResourceLocks } from '../../modules/documents';
import type { FactsModule } from '../../modules/facts';
import type { GenerationModule } from '../../modules/generation';
import type { ProcessingModule } from '../../modules/processing';
import { requirePackage } from '../../modules/templates';
import type { WorksModule } from '../../modules/works';
import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { UnitOfWork } from '../../platform/transactions';
import { requireIdle, requireRevision, workLockKey } from '../work-guards';

// Старт генерации: снимок сведений, результат, запуск и журнал в одной транзакции. Исполнение — в worker.
export const startGeneration =
  (deps: {
    uow: UnitOfWork;
    works: WorksModule;
    facts: FactsModule;
    processing: ProcessingModule;
    generation: GenerationModule;
    audit: AuditModule;
    locks: ResourceLocks;
  }) =>
  async (
    scope: WorkspaceScope,
    input: { workId: WorkId; revision: number; correlationId: string },
  ) => {
    scope.require('works.generate');
    await deps.locks.run(
      workLockKey(scope.workspaceId, input.workId),
      async () => {
        const { work, documents } = await requireRevision(
          deps.works.queries,
          scope,
          input.workId,
          input.revision,
        );
        await requireIdle(deps.processing.queries, scope, input.workId);
        const { values } = await deps.facts.queries.get(scope, input.workId);
        await deps.uow.run(async (tx) => {
          const generationId = await deps.generation
            .in(tx)
            .commands.create(scope, {
              workId: input.workId,
              revision: work.revision,
              confirmed: work.confirmedRevision === work.revision,
              values,
              packageVersion: work.packageVersion,
              templates: requirePackage(work.packageVersion).documents.map(
                (template) => ({
                  templateVersion: template.version,
                  title: template.title,
                  filename: template.filename,
                }),
              ),
            });
          await deps.processing.in(tx).commands.start(scope, {
            workId: input.workId,
            kind: 'generation',
            inputRevision: work.inputRevision,
            documentIds: documents.map((doc) => doc.id),
            settingsRevision: null,
            generationId,
            correlationId: input.correlationId,
            modelSnapshot: { vision: '', extraction: '' },
          });
          await deps.works.in(tx).commands.recordEvent(scope, {
            workId: input.workId,
            kind: 'generation.queued',
          });
          await deps.audit.in(tx).commands.record({
            workspaceId: scope.workspaceId,
            actorId: scope.userId,
            action: 'generation.started',
            target: { kind: 'generation', id: generationId },
            data: { workId: input.workId },
            correlationId: input.correlationId,
          });
        });
      },
    );
  };
