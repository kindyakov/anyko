import type { DocumentsModule, ResourceLocks } from '../../modules/documents';
import { WorkError, type WorksModule } from '../../modules/works';
import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { UnitOfWork } from '../../platform/transactions';
import { requireCleanSources, requireWork, workLockKey } from '../work-guards';

import { workSourceLimit } from './attach-documents';
import type { WorkIntakeDeps } from './deps';

// Загрузка исходника в работу. Файл и хранилище пишутся до транзакции; привязка к работе — в транзакции.
export const uploadDocument =
  (deps: {
    uow: UnitOfWork;
    works: WorksModule;
    documents: DocumentsModule;
    locks: ResourceLocks;
    lockDocumentRevisions: WorkIntakeDeps['lockDocumentRevisions'];
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
        if (sources.length >= workSourceLimit)
          throw new WorkError('INVALID_WORK_INPUT');
        // New storage keys are scoped to the work. The separator is forbidden in HTTP headers.
        const legacy = sources.some(
          (source) => source.uploaded && source.requestKey === input.requestKey,
        );
        const requestKey = legacy
          ? input.requestKey
          : `work\u001f${input.workId}\u001f${input.requestKey}`;
        const document = await deps.documents.internal.commands.upload({
          workspaceId: scope.workspaceId,
          actorId: scope.userId,
          filename: input.filename,
          bytes: input.bytes,
          correlationId: input.correlationId,
          requestKey,
        });
        await deps.uow.run(async (tx) => {
          const documents = await deps.lockDocumentRevisions(
            tx,
            scope.workspaceId,
            [document.id],
            true,
          );
          if (!documents.length) throw new WorkError('NOT_FOUND');
          await deps.works.in(tx).commands.attachDocuments(scope, {
            workId: input.workId,
            documents: documents.map((source) => ({
              ...source,
              uploaded: true,
            })),
          });
        });
        return document;
      },
    );
  };
