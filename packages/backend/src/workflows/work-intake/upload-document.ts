import type { DocumentsModule, ResourceLocks } from '../../modules/documents';
import { WorkError, type WorksModule } from '../../modules/works';
import { brandDocumentId, type WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { UnitOfWork } from '../../platform/transactions';
import { requireCleanSources, requireWork, workLockKey } from '../work-guards';

const sourceLimit = 20;

// Загрузка исходника в работу. Файл и хранилище пишутся до транзакции; привязка к работе — в транзакции.
export const uploadDocument =
  (deps: {
    uow: UnitOfWork;
    works: WorksModule;
    documents: DocumentsModule;
    locks: ResourceLocks;
  }) =>
  async (
    scope: WorkspaceScope,
    input: {
      workId: WorkId;
      filename: string;
      bytes: Uint8Array;
      correlationId: string;
      requestKey: string;
    },
  ) => {
    scope.require('documents.upload');
    return deps.locks.run(
      workLockKey(scope.workspaceId, input.workId),
      async () => {
        await requireWork(deps.works.queries, scope, input.workId);
        const sources = await requireCleanSources(
          deps.works.queries,
          scope,
          input.workId,
        );
        if (sources.length >= sourceLimit)
          throw new WorkError('INVALID_WORK_INPUT');
        const document = await deps.documents.internal.commands.upload({
          workspaceId: scope.workspaceId,
          actorId: scope.userId,
          filename: input.filename,
          bytes: input.bytes,
          correlationId: input.correlationId,
          requestKey: input.requestKey,
        });
        await deps.uow.run((tx) =>
          deps.works.in(tx).commands.attachDocument(scope, {
            workId: input.workId,
            documentId: brandDocumentId(document.id),
          }),
        );
        return document;
      },
    );
  };
