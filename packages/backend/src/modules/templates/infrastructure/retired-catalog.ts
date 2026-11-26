import type { Database } from '@anyko/database';

export function createRetiredCatalogCleanup(db: Pick<Database, '$executeRaw'>) {
  return async () => {
    await db.$executeRaw`SELECT anyko_prune_retired_bfl_catalog()`;
  };
}
