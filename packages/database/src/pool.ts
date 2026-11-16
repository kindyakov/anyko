import { Pool } from 'pg';

export type DatabasePool = Pool;

/**
 * One pool per process. Prisma queries and session advisory locks borrow connections
 * from it; the composition root that creates the pool also ends it.
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
