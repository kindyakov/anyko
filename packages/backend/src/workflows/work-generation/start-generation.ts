import {
  hasSubmittedAttachments,
  submittedAttachmentRows,
} from '@anyko/document-values/attachments';

import type { AuditModule } from '../../modules/audit';
import type { ConnectionsModule } from '../../modules/connections';
import type { ResourceLocks } from '../../modules/documents';
import type { FactsModule } from '../../modules/facts';
import type { GenerationModule } from '../../modules/generation';
import type { ProcessingModule } from '../../modules/processing';
import { WorkError, type WorksModule } from '../../modules/works';
import type { Clock } from '../../platform/clock';
import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { UnitOfWork } from '../../platform/transactions';
import { changeWork } from '../change-work';
import { workCommandPolicy } from '../work-command-guards';
import type { ResolveWorkPackage } from '../work-package';

// Старт генерации: снимок сведений, результат, запуск и журнал в одной транзакции. Исполнение — в worker.
export const startGeneration =
  (deps: {
    resolvePackage: ResolveWorkPackage;
    uow: UnitOfWork;
    clock: Clock;
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
          const facts = deps.facts.in(tx);
          const { description: pack } = deps.resolvePackage(
            work.packageVersion,
          );
          const { values, needsReview } = await facts.queries.get(
            scope,
            input.workId,
            pack.fields,
          );
          if (needsReview?.length) throw new WorkError('NOT_READY');
          if (hasSubmittedAttachments(pack.fields))
            values.submittedAttachments = submittedAttachmentRows(
              values.submittedAttachments,
              new Set(
                documents.filter(({ deleted }) => !deleted).map(({ id }) => id),
              ),
              pack.attachments ?? [],
            );
          const confirmed = work.confirmedRevision === work.revision;
          let revision = work.revision;
          if (pack.defaultDocumentDate && values.documentDate === null) {
            const date = deps.clock
              .now()
              .toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' });
            await facts.internal.defaultDocumentDate(
              scope.workspaceId,
              input.workId,
              date,
            );
            await deps.works
              .in(tx)
              .internal.touch(scope.workspaceId, input.workId, {
                expectedRevision: work.revision,
                confirmed,
              });
            values.documentDate = date;
            revision++;
          }
          const generationId = await deps.generation
            .in(tx)
            .commands.create(scope, {
              workId: input.workId,
              revision,
              confirmed,
              values,
              packageVersion: work.packageVersion,
              templates: pack.documents.map((template) => ({
                templateVersion: template.version,
                title: template.title,
                filename: template.filename,
              })),
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
