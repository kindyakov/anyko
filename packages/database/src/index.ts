import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/client';

import type { DatabasePool } from './pool';

export { createDatabasePool, createLockPool, type DatabasePool } from './pool';
export { createResourceLocks } from './resource-locks';

/** Prisma client on a shared pool; `$disconnect` leaves the pool open for its owner. */
export function createDatabase(pool: DatabasePool) {
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}
export type Database = ReturnType<typeof createDatabase>;
