import { Pool } from 'pg';

export type DatabasePool = Pool;

/**
 * Query pool for one process: Prisma and the agent store borrow connections here.
 * The composition root that creates it also ends it.
 */
export function createDatabasePool(url: string): DatabasePool {
  return new Pool({
    connectionString: url,
    max: 20,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
    // Prisma DateTime uses UTC values in timestamp-without-time-zone columns.
    options: '-c timezone=UTC',
  });
}

/**
 * Separate small pool for session advisory locks. A held lock keeps its connection for the
 * whole external operation, and waiters keep theirs while they poll. Sharing the query pool
 * would let those waiters take the connections that queries running under the lock need,
 * so the holder would wait for a connection it cannot get. Keep this pool apart from queries.
 */
export function createLockPool(url: string): DatabasePool {
  return new Pool({
    connectionString: url,
    max: 4,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
  });
}
