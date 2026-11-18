import { z } from 'zod';

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
import { uuidV7 } from '../../platform/ids';
import { type Tx, type UnitOfWork } from '../../platform/transactions';

const resourceIdentity = z.object({
  work: z.object({ id: z.uuid() }).optional(),
  document: z.object({ id: z.uuid() }).optional(),
});
const unavailable = () => ({
  status: 404,
  body: { error: { code: 'NOT_FOUND', requestId: uuidV7() } },
});
const workUploadCommand =
  'POST /workspaces/:workspaceId/works/:workId/documents';
const workUploadResponses = (ids: string[]) =>
  ids.map((id) => ({
    path: ['document', 'id'],
    id,
    command: workUploadCommand,
  }));

export function createResourceAwareIdempotencyStore(
  db: Database,
  uow: UnitOfWork,
): IdempotencyStore {
  const store = createIdempotencyStore(db);
  return {
    ...store,
    complete: (ref, token, response, now) => {
      const resource = resourceIdentity.safeParse(response.body).data;
      if (!resource?.work && !resource?.document)
        return store.complete(ref, token, response, now);
      return uow.run(async (tx) => {
        const visible = resource.work
          ? await lockLiveWorkForResponse(tx, ref.workspaceId, resource.work.id)
          : resource.document &&
            (ref.command === workUploadCommand
              ? await lockLiveWorkUploadForResponse(
                  tx,
                  ref.workspaceId,
                  resource.document.id,
                )
              : await lockLiveDocumentForResponse(
                  tx,
                  ref.workspaceId,
                  resource.document.id,
                ));
        return idempotencyStoreFor(tx).complete(
          ref,
          token,
          visible ? response : unavailable(),
          now,
        );
      });
    },
  };
}

export function redactDeletedWorkResponses(
  tx: Tx,
  workspaceId: string,
  workId: string,
  documentIds: string[],
) {
  return redactResourceResponses(
    tx,
    workspaceId,
    [{ path: ['work', 'id'], id: workId }, ...workUploadResponses(documentIds)],
    unavailable(),
  );
}

export function redactWorkUploadResponses(
  tx: Tx,
  workspaceId: string,
  documentIds: string[],
) {
  return redactResourceResponses(
    tx,
    workspaceId,
    workUploadResponses(documentIds),
    unavailable(),
  );
}
