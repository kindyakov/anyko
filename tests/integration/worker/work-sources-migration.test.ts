import { expect, test } from 'bun:test';
import { readdir } from 'node:fs/promises';

import {
  hasPdfOcrProcessorVersion,
  pdfOcrProcessorVersionPattern,
} from '@anyko/backend/documents';
import { createDatabasePool } from '@anyko/database';

test('the shared-source migration preserves old links and fills only usable OCR revisions', async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (
    !databaseUrl ||
    !/^\/anyko_test(?:_[a-z0-9_]+)?$/.test(new URL(databaseUrl).pathname)
  )
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

test('PDF readiness matches the document policy and restores only missing, live links', async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (
    !databaseUrl ||
    !/^\/anyko_test(?:_[a-z0-9_]+)?$/.test(new URL(databaseUrl).pathname)
  )
    throw new Error('Dedicated anyko_test TEST_DATABASE_URL required');
  const pool = createDatabasePool(databaseUrl);
  const db = await pool.connect();
  const schema = `catalog_${crypto.randomUUID().replaceAll('-', '')}`;
  const migrations = new URL(
    '../../../packages/database/prisma/migrations/',
    import.meta.url,
  );
  const versions = [
    'mineru-4.1.7+eslav.1',
    'mineru-4.1.7+cyrillic-pdf.1',
    'mineru-4.2.0+eslav.20',
    'mineru-4.2.0+cyrillic-pdf.20',
    'mineru-4.1.7',
    'mineru-4.1.7+cyrillic-image.1',
    'mineru-4.1.7+cyrillic-pdf.',
    'mineru-4.1.7+eslav.1-extra',
  ];
  try {
    await db.query(`CREATE SCHEMA ${schema}`);
    await db.query(`SET search_path TO ${schema}`);
    for (const entry of (await readdir(migrations)).sort()) {
      if (
        !/^\d{12}_/.test(entry) ||
        entry === '202611180019_recognition_search' ||
        entry > '202611180020_shared_work_sources'
      )
        continue;
      await db.query(
        await Bun.file(new URL(`${entry}/migration.sql`, migrations)).text(),
      );
    }
    await db.query(`
      INSERT INTO "AnykoWorkspace" (id, name) VALUES ('own', 'Own');
      INSERT INTO "DocumentPackageVersion" (version, "packageId", title) VALUES ('test-v1', 'test', 'Test');
      INSERT INTO "Work" (id, "workspaceId", "packageVersion", title, "createdBy", "updatedAt")
        SELECT id, 'own', 'test-v1', id, 'u', now()
        FROM unnest(ARRAY['new', 'pinned', 'removed', 'deleted-work']) AS id;
    `);
    await db.query(
      `
      INSERT INTO "SourceDocument"
        (id, "workspaceId", filename, "sourceKey", "sourceChecksum", "requestKey", size, "createdBy")
        SELECT 'pdf-' || ord, 'own', 'scan-' || ord || '.pdf', 'pdf-' || ord || '.pdf', 'hash-' || ord, ord::text, 1, 'u'
        FROM unnest($1::text[]) WITH ORDINALITY AS versions(version, ord);
    `,
      [versions],
    );
    await db.query(
      `
      INSERT INTO "Run"
        (id, "workspaceId", "documentId", revision, kind, status, "resultKey", "processorVersion", "initiatedBy", "correlationId", "updatedAt")
        SELECT 'run-' || ord, 'own', 'pdf-' || ord, 1, 'document.ocr', 'succeeded',
          'result-' || ord, version, 'u', 'c', now()
        FROM unnest($1::text[]) WITH ORDINALITY AS versions(version, ord);
    `,
      [versions],
    );
    await db.query(`
      INSERT INTO "Run"
        (id, "workspaceId", "documentId", revision, kind, status, "resultKey", "processorVersion", "initiatedBy", "correlationId", "updatedAt")
        VALUES ('second-ocr', 'own', 'pdf-2', 2, 'document.ocr', 'succeeded',
          'second-result', 'mineru-4.1.7+cyrillic-pdf.1', 'u', 'c', now()),
          ('pending-ocr', 'own', 'pdf-2', 3, 'document.ocr', 'queued', NULL, NULL, 'u', 'c', now());
      INSERT INTO "SourceDocument"
        (id, "workspaceId", filename, "sourceKey", "sourceChecksum", "requestKey", size, "createdBy")
        VALUES ('deleted-source', 'own', 'deleted-source.pdf', 'deleted-source.pdf', 'deleted-hash', 'deleted-key', 1, 'u');
      INSERT INTO "Run"
        (id, "workspaceId", "documentId", revision, kind, status, "resultKey", "processorVersion", "initiatedBy", "correlationId", "updatedAt")
        VALUES ('deleted-run', 'own', 'deleted-source', 1, 'document.ocr', 'succeeded',
          'deleted-result', 'mineru-4.1.7+cyrillic-pdf.1', 'u', 'c', now());
      INSERT INTO "WorkDocument" ("workId", "workspaceId", "documentId", "ocrRevision", removed)
        VALUES ('new', 'own', 'pdf-2', NULL, false),
          ('pinned', 'own', 'pdf-2', 1, false),
          ('removed', 'own', 'pdf-2', NULL, true),
          ('new', 'own', 'pdf-5', NULL, false),
          ('deleted-work', 'own', 'pdf-2', NULL, false),
          ('new', 'own', 'deleted-source', NULL, false);
      UPDATE "Work" SET "deletedAt" = now() WHERE id = 'deleted-work';
      UPDATE "SourceDocument" SET "deletedAt" = now() WHERE id = 'deleted-source';
    `);
    const expression = await Bun.file(
      new URL('202611210072_ready_cyrillic_pdf/migration.sql', migrations),
    ).text();
    const loads = () =>
      db.query(
        'SELECT id, attempts, status, "resultKey" FROM "Run" ORDER BY id',
      );
    const before = await loads();
    await db.query(expression);

    const { rows } = await db.query<{ version: string; ready: boolean }>(`
      SELECT run."processorVersion" AS version, ready.revision IS NOT NULL AS ready
      FROM "Run" run
      LEFT JOIN "ReadyDocumentRun" ready
        ON ready."workspaceId" = run."workspaceId" AND ready."documentId" = run."documentId" AND ready.revision = run.revision
      WHERE run.revision = 1 AND run.id LIKE 'run-%'
      ORDER BY run.id
    `);
    expect(rows).toEqual(
      versions.map((version) => ({
        version,
        ready: hasPdfOcrProcessorVersion(version),
      })),
    );
    expect(rows.map(({ ready }) => ready)).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
    const liveView = await db.query<{ definition: string }>(
      `SELECT pg_get_viewdef('"ReadyDocumentRun"'::regclass) AS definition`,
    );
    expect(liveView.rows[0]?.definition).toContain(
      pdfOcrProcessorVersionPattern.source,
    );
    expect(
      (
        await db.query(
          'SELECT "workId", "documentId", "ocrRevision" FROM "WorkDocument" ORDER BY "workId", "documentId"',
        )
      ).rows,
    ).toEqual([
      { workId: 'deleted-work', documentId: 'pdf-2', ocrRevision: null },
      { workId: 'new', documentId: 'deleted-source', ocrRevision: null },
      { workId: 'new', documentId: 'pdf-2', ocrRevision: 2 },
      { workId: 'new', documentId: 'pdf-5', ocrRevision: null },
      { workId: 'pinned', documentId: 'pdf-2', ocrRevision: 1 },
      { workId: 'removed', documentId: 'pdf-2', ocrRevision: null },
    ]);
    expect((await loads()).rows).toEqual(before.rows);
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
