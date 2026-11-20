import { z } from 'zod';

import { createMineruParser } from '@anyko/backend/runtime';
import { createDatabase, createDatabasePool } from '@anyko/database';
if (
  !process.argv.includes('--applications-stopped') ||
  !process.argv.includes('--storage-requests-drained')
)
  throw new Error(
    'Requires verified application shutdown and settled storage requests; see document-vertical.md',
  );
const env = z
  .object({ DATABASE_URL: z.string(), MINERU_BASE_URL: z.url() })
  .parse(process.env);
const pool = createDatabasePool(env.DATABASE_URL);
const db = createDatabase(pool);
const parser = createMineruParser({
  baseUrl: env.MINERU_BASE_URL,
  timeoutMs: 1000,
});
try {
  const operations = await db.processingIo.findMany({
    where: { kind: 'document' },
    select: { id: true, documentId: true, workspaceId: true },
  });
  for (const operation of operations) {
    if (!operation.documentId) throw new Error('MISSING_DOCUMENT_IO_SUBJECT');
    for (const attempt of await db.runAttempt.findMany({
      where: {
        workspaceId: operation.workspaceId,
        documentId: operation.documentId,
      },
      select: { id: true },
    }))
      await parser.eraseAttempt(attempt.id);
    await db.processingIo.delete({ where: { id: operation.id } });
  }
  // Same operator gate: no API/worker or unsettled S3 writes may remain.
  const workOperations = await db.processingIo.deleteMany({
    where: { kind: 'work' },
  });
  console.info(
    JSON.stringify({
      reconciled: operations.length,
      workBarriers: workOperations.count,
    }),
  );
} finally {
  await db.$disconnect();
  await pool.end();
}
