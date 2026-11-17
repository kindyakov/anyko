import type { Database } from '@anyko/database';

import type { IdempotencyMaintenanceStore } from '../maintenance';

export function createIdempotencyMaintenanceStore(
  db: Pick<Database, '$executeRaw'>,
): IdempotencyMaintenanceStore {
  return {
    async deleteExpired(now, batchSize) {
      // The selection and deletion share row locks. An active API claim never loses its key.
      return db.$executeRaw`WITH expired AS (
      SELECT "workspaceId", "command", "key" FROM "IdempotencyKey"
      WHERE "expiresAt" < ${now} AND "lockedUntil" <= ${now}
      ORDER BY "expiresAt" FOR UPDATE SKIP LOCKED LIMIT ${batchSize}
    ) DELETE FROM "IdempotencyKey" k USING expired e
      WHERE k."workspaceId"=e."workspaceId" AND k."command"=e."command" AND k."key"=e."key"`;
    },
  };
}
