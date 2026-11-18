import type { AuditModule } from '../../modules/audit';
import type { ConnectionsModule } from '../../modules/connections';
import type { ResourceLocks } from '../../modules/documents';
import type { FactsModule } from '../../modules/facts';
import type { GenerationModule } from '../../modules/generation';
import type { ProcessingModule } from '../../modules/processing';
import { requirePackage } from '../../modules/templates';
import type { WorksModule } from '../../modules/works';
import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { UnitOfWork } from '../../platform/transactions';
import { changeWork } from '../change-work';
import { workCommandPolicy } from '../work-command-guards';

// Старт генерации: снимок сведений, результат, запуск и журнал в одной транзакции. Исполнение — в worker.
export const startGeneration =
  (deps: {
    uow: UnitOfWork;
    works: WorksModule;
    facts: FactsModule;
    processing: ProcessingModule;
    connections: ConnectionsModule;
    generation: GenerationModule;
    audit: AuditModule;
    locks: ResourceLocks;
  }) =>
  async (
    scope: WorkspaceScope,
    input: { workId: WorkId; revision: number; correlationId: string },
  ) => {
    scope.require(workCommandPolicy.generate.right);
    await changeWork(
      deps,
      scope,
      {
        workId: input.workId,
        expectedRevision: input.revision,
        command: 'generate',
        event: 'generation.queued',
      },
      ({ work, documents }) =>
        async (tx) => {
          const connection = await deps.connections
            .in(tx)
            .internal.configuration(scope.workspaceId);
          const { values } = await deps.facts
            .in(tx)
            .queries.get(scope, input.workId);
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
            settingsRevision: connection?.revision ?? null,
            generationId,
            correlationId: input.correlationId,
            modelSnapshot: { vision: '', extraction: '' },
          });
          await deps.audit.in(tx).commands.record({
            workspaceId: scope.workspaceId,
            actorId: scope.userId,
            action: 'generation.started',
            target: { kind: 'generation', id: generationId },
            data: { workId: input.workId },
            correlationId: input.correlationId,
          });
        },
    );
  };
