import type { Database } from '@anyko/database';

import { lockLiveDocumentForResponse } from '../../modules/documents/infrastructure/commands';
import type { IdempotencyStore } from '../../modules/idempotency';
import {
  createIdempotencyStore,
  idempotencyStoreFor,
  redactResourceResponses,
} from '../../modules/idempotency/infrastructure/store';
import {
  lockLiveWorkForResponse,
  lockLiveWorkUploadForResponse,
} from '../../modules/works/infrastructure/deletion-store';
import { type Tx, type UnitOfWork } from '../../platform/transactions';

const workUploadCommand =
  'POST /workspaces/:workspaceId/works/:workId/documents';
export function createResourceAwareIdempotencyStore(
  db: Database,
  uow: UnitOfWork,
): IdempotencyStore {
  const store = createIdempotencyStore(db);
  return {
    ...store,
    complete: (ref, token, outcome, resource, now) => {
      if (!resource) return store.complete(ref, token, outcome, resource, now);
      return uow.run(async (tx) => {
        for (const id of [...new Set(resource.documentIds)].sort()) {
          if (!(await lockLiveDocumentForResponse(tx, ref.workspaceId, id)))
            return idempotencyStoreFor(tx).complete(
              ref,
              token,
              { kind: 'resource_unavailable' },
              resource,
              now,
            );
        }
        const visible =
          resource.kind === 'work'
            ? await lockLiveWorkForResponse(tx, ref.workspaceId, resource.id)
            : (await lockLiveDocumentForResponse(
                tx,
                ref.workspaceId,
                resource.id,
              )) &&
              (ref.command !== workUploadCommand ||
                (await lockLiveWorkUploadForResponse(
                  tx,
                  ref.workspaceId,
                  resource.id,
                )));
        return idempotencyStoreFor(tx).complete(
          ref,
          token,
          visible ? outcome : { kind: 'resource_unavailable' },
          resource,
          now,
        );
      });
    },
  };
}

export function redactDeletedDocumentResponses(
  tx: Tx,
  workspaceId: string,
  documentId: string,
) {
  return redactResourceResponses(tx, workspaceId, [
    { kind: 'document', id: documentId },
  ]);
}

export async function redactDeletedWorkResponses(
  tx: Tx,
  workspaceId: string,
  workId: string,
  documentIds: string[],
) {
  await redactResourceResponses(tx, workspaceId, [
    { kind: 'work', id: workId },
  ]);
  await redactWorkUploadResponses(tx, workspaceId, documentIds);
}

export function redactWorkUploadResponses(
  tx: Tx,
  workspaceId: string,
  documentIds: string[],
) {
  return redactResourceResponses(
    tx,
    workspaceId,
    documentIds.map((id) => ({
      kind: 'document' as const,
      id,
    })),
    workUploadCommand,
  );
}
