import type { Database } from '@anyko/database';

import { lockLiveDocumentForResponse } from '../../modules/documents/infrastructure/commands';
import type { IdempotencyStore } from '../../modules/idempotency';
import {
  createIdempotencyStore,
  idempotencyStoreFor,
  redactResourceResponses,
} from '../../modules/idempotency/infrastructure/store';
import { lockLiveWorkForResponse } from '../../modules/works/infrastructure/deletion-store';
import { type Tx, type UnitOfWork } from '../../platform/transactions';

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
        const visible =
          resource.kind === 'work'
            ? await lockLiveWorkForResponse(tx, ref.workspaceId, resource.id)
            : await lockLiveDocumentForResponse(
                tx,
                ref.workspaceId,
                resource.id,
              );
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

export function redactDeletedWorkResponses(
  tx: Tx,
  workspaceId: string,
  workId: string,
  documentIds: string[],
) {
  return redactResourceResponses(tx, workspaceId, [
    { kind: 'work', id: workId },
    ...documentIds.map((id) => ({ kind: 'document' as const, id })),
  ]);
}
