import { PrismaClient } from '../generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
export function createDatabase(url: string) {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: url,
      max: 10,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
    }),
  });
}
export type Database = ReturnType<typeof createDatabase>;
