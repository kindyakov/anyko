import { createDatabase } from '@anyko/database';
import { createMineruParser } from '@anyko/backend/runtime';
import { z } from 'zod';
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
const db = createDatabase(env.DATABASE_URL);
const parser = createMineruParser({
  baseUrl: env.MINERU_BASE_URL,
  timeoutMs: 1000,
});
try {
  const operations = await db.documentIo.findMany({
    select: { id: true, documentId: true, workspaceId: true },
  });
  for (const operation of operations) {
    for (const attempt of await db.processorAttempt.findMany({
      where: {
        workspaceId: operation.workspaceId,
        documentId: operation.documentId,
      },
      select: { id: true },
    }))
      await parser.eraseAttempt(attempt.id);
    await db.documentIo.delete({ where: { id: operation.id } });
  }
  // Same operator gate: no API/worker or unsettled S3 writes may remain.
  const workOperations = await db.workIo.deleteMany();
  console.info(
    JSON.stringify({
      reconciled: operations.length,
      workBarriers: workOperations.count,
    }),
  );
} finally {
  await db.$disconnect();
}
