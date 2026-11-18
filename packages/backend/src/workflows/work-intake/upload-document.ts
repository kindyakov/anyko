import type { DocumentsModule, ResourceLocks } from '../../modules/documents';
import type { WorksModule } from '../../modules/works';
import { brandDocumentId, type WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { UnitOfWork } from '../../platform/transactions';
import {
  requireUploadCapacity,
  workCommandPolicy,
  workCommandSources,
} from '../work-command-guards';
import { requireWork, workLockKey } from '../work-guards';

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
    scope.require(workCommandPolicy.upload.right);
    return deps.locks.run(
      workLockKey(scope.workspaceId, input.workId),
      async () => {
        await requireWork(deps.works.queries, scope, input.workId);
        const sources = workCommandSources(
          'upload',
          await deps.works.queries.sources(scope, input.workId),
        );
        requireUploadCapacity(sources);
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
