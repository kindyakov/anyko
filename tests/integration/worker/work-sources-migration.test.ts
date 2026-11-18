import { expect, test } from 'bun:test';
import { readdir } from 'node:fs/promises';

import { createDatabasePool } from '@anyko/database';

test('the shared-source migration preserves old links and fills only usable OCR revisions', async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl || new URL(databaseUrl).pathname !== '/anyko_test')
    throw new Error('Dedicated anyko_test TEST_DATABASE_URL required');
  const migrations = new URL(
    '../../../packages/database/prisma/migrations/',
    import.meta.url,
  );
  const pool = createDatabasePool(databaseUrl);
  const db = await pool.connect();
  const schema = `catalog_${crypto.randomUUID().replaceAll('-', '')}`;
  try {
    await db.query(`CREATE SCHEMA ${schema}`);
    await db.query(`SET search_path TO ${schema}`);
    for (const entry of (await readdir(migrations)).sort()) {
      // 0019 only adds the name search indexes and a shared extension.
      if (!/^\d{12}_/.test(entry) || entry >= '202611180019') continue;
      await db.query(
        await Bun.file(new URL(`${entry}/migration.sql`, migrations)).text(),
      );
    }
    await db.query(`
      INSERT INTO "AnykoWorkspace" (id, name) VALUES ('own', 'Own'), ('other', 'Other');
      INSERT INTO "DocumentPackageVersion" (version, "packageId", title) VALUES ('test-v1', 'test', 'Test');
      INSERT INTO "Work" (id, "workspaceId", "packageVersion", title, "createdBy", "updatedAt")
        VALUES ('first', 'own', 'test-v1', 'A', 'u', now()),
          ('second', 'own', 'test-v1', 'B', 'u', now()), ('foreign', 'other', 'test-v1', 'C', 'u', now());
      INSERT INTO "SourceDocument"
        (id, "workspaceId", filename, "sourceKey", "sourceChecksum", "requestKey", size, "createdBy")
        VALUES ('ready', 'own', 'ready.pdf', 'ready.pdf', 'hash', '1', 1, 'u'),
          ('waiting', 'own', 'waiting.pdf', 'waiting.pdf', 'hash', '2', 1, 'u');
      INSERT INTO "WorkDocument" ("workId", "workspaceId", "documentId")
        VALUES ('first', 'own', 'ready'), ('first', 'own', 'waiting');
      INSERT INTO "Run"
        (id, "workspaceId", "documentId", revision, kind, status, "resultKey", "processorVersion", "initiatedBy", "correlationId", "updatedAt")
        VALUES ('old', 'own', 'ready', 1, 'document.ocr', 'succeeded', 'old.json', 'mineru-fixture+eslav.1', 'u', 'c', now()),
          ('retry', 'own', 'ready', 2, 'document.ocr', 'queued', NULL, NULL, 'u', 'c', now()),
          ('stale', 'own', 'waiting', 1, 'document.ocr', 'succeeded', 'legacy.json', 'mineru-legacy', 'u', 'c', now());
    `);
    await db.query(
      await Bun.file(
        new URL('202611180020_shared_work_sources/migration.sql', migrations),
      ).text(),
    );
    expect(
      (
        await db.query(
          'SELECT "workId", "documentId", "ocrRevision", uploaded FROM "WorkDocument" ORDER BY "documentId"',
        )
      ).rows,
    ).toEqual([
      { workId: 'first', documentId: 'ready', ocrRevision: 1, uploaded: true },
      {
        workId: 'first',
        documentId: 'waiting',
        ocrRevision: null,
        uploaded: true,
      },
    ]);
    expect(
      (await db.query('SELECT id, "resultKey", status FROM "Run" ORDER BY id'))
        .rows,
    ).toEqual([
      { id: 'old', resultKey: 'old.json', status: 'succeeded' },
      { id: 'retry', resultKey: null, status: 'queued' },
      { id: 'stale', resultKey: 'legacy.json', status: 'succeeded' },
    ]);
    expect(
      (
        await db.query(
          'SELECT id, "sourceKey" FROM "SourceDocument" ORDER BY id',
        )
      ).rows,
    ).toEqual([
      { id: 'ready', sourceKey: 'ready.pdf' },
      { id: 'waiting', sourceKey: 'waiting.pdf' },
    ]);
    await db.query(`
      INSERT INTO "WorkDocument" ("workspaceId", "workId", "documentId", "ocrRevision")
      VALUES ('own', 'second', 'ready', 1)
    `);
    const foreignLink = await db
      .query(
        `
      INSERT INTO "WorkDocument" ("workspaceId", "workId", "documentId")
      VALUES ('other', 'foreign', 'ready')
    `,
      )
      .catch((error: unknown) => error);
    expect(foreignLink).toMatchObject({ code: '23503' });
    const wrongRevision = await db
      .query(
        `
      UPDATE "WorkDocument" SET "ocrRevision" = 3 WHERE "workId" = 'second'
    `,
      )
      .catch((error: unknown) => error);
    expect(wrongRevision).toMatchObject({ code: '23503' });
  } finally {
    try {
      await db.query('ROLLBACK');
      await db.query('RESET search_path');
      await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      db.release();
      await pool.end();
    }
  }
});
