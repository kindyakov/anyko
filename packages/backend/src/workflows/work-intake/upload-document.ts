import type { DocumentView } from '../../modules/documents';
import { WorkError } from '../../modules/works';
import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import { changeWork } from '../change-work';
import {
  requireUploadCapacity,
  workCommandPolicy,
} from '../work-command-guards';

import type { WorkIntakeDeps } from './deps';

// Загрузка исходника в работу. Файл и хранилище пишутся до транзакции; привязка к работе — в транзакции.
export const uploadDocument =
  (
    deps: Pick<
      WorkIntakeDeps,
      | 'uow'
      | 'works'
      | 'documents'
      | 'locks'
      | 'processing'
      | 'lockDocumentRevisions'
    >,
  ) =>
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
    let uploaded: DocumentView | undefined;
    await changeWork(
      deps,
      scope,
      {
        workId: input.workId,
        command: 'upload',
        event: 'documents.changed',
        sourceChange: true,
      },
      async ({ documents: sources }) => {
        requireUploadCapacity(sources);
        // Historical work uploads can still be retried using their original storage key.
        const legacy = sources.some(
          (source) => source.uploaded && source.requestKey === input.requestKey,
        );
        const document = await deps.documents.internal.commands.upload({
          workspaceId: scope.workspaceId,
          actorId: scope.userId,
          filename: input.filename,
          bytes: input.bytes,
          correlationId: input.correlationId,
          requestKey: legacy
            ? input.requestKey
            : `work\u001f${input.workId}\u001f${input.requestKey}`,
        });
        uploaded = document;
        if (sources.some(({ id }) => id === document.id)) return;
        return async (tx, lockRevision) => {
          const [source] = await deps.lockDocumentRevisions(
            tx,
            scope.workspaceId,
            [document.id],
            true,
          );
          if (!source) throw new WorkError('NOT_FOUND');
          await lockRevision();
          await deps.works.in(tx).commands.attachDocuments(scope, {
            workId: input.workId,
            documents: [{ ...source, uploaded: true }],
          });
          return { confirmed: false };
        };
      },
    );
    if (!uploaded) throw new Error('UPLOADED_DOCUMENT_MISSING');
    return uploaded;
  };
