import { expect, test } from 'bun:test';
import { readdir } from 'node:fs/promises';

import { createDatabase, createDatabasePool } from '@anyko/database';
import { createLogger } from '@anyko/logger';

import type { SourceStorage } from '../../../packages/backend/src/modules/documents';
import { createBackend } from '../../../packages/backend/src/runtime';

import { integrationConfig } from './support/composition';

const migration = '202611260074_retire_bfl_packages';
const migrations = new URL(
  '../../../packages/database/prisma/migrations/',
  import.meta.url,
);
const retained = [
  'bfl-bankruptcy-v12',
  'bfl-bankruptcy-v13',
  'bfl-bankruptcy-v14',
];
const retainedTemplates = [
  'bfl-creditors-v3',
  'bfl-creditors-v4',
  'bfl-inventory-v2',
  'bfl-inventory-v3',
  'bfl-statement-v11',
  'bfl-statement-v12',
];

test('BFL retirement retries generated file deletion and keeps retained packages and catalog sources', async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (
    !databaseUrl ||
    !/^\/anyko_test(?:_[a-z0-9_]+)?$/.test(new URL(databaseUrl).pathname)
  )
    throw new Error('Dedicated anyko_test TEST_DATABASE_URL required');
  const baseUrl = new URL(databaseUrl);
  const databaseName = baseUrl.pathname.slice(1);
  const fixtureName = `${databaseName.slice(0, 44)}_bfl_${crypto.randomUUID().slice(0, 8)}`;
  const pool = createDatabasePool(databaseUrl);
  const isolatedUrl = new URL(databaseUrl);
  isolatedUrl.pathname = `/${fixtureName}`;
  const isolatedPool = createDatabasePool(isolatedUrl.href);
  const db = createDatabase(isolatedPool);
  const workspaceId = 'workspace';
  const workId = 'retired';
  const sourceId = 'source';
  const queuedRunId = crypto.randomUUID();
  const correlationId = crypto.randomUUID();
  const logger = createLogger({
    service: 'worker',
    environment: 'test',
    release: 'retire-bfl',
    level: 'fatal',
  });
  const objects = new Set([
    'generated/old.docx',
    'generated/retained.docx',
    'source.pdf',
    'ocr.json',
  ]);
  let failStorage = true;
  const storage: SourceStorage = {
    get: () => Promise.reject(new Error('Unexpected storage read')),
    put: () => Promise.reject(new Error('Unexpected storage write')),
    exists: (key) => Promise.resolve(objects.has(key)),
    delete: (key) => {
      if (failStorage && key === 'generated/old.docx')
        return Promise.reject(new Error('Storage unavailable'));
      objects.delete(key);
      return Promise.resolve();
    },
  };
  const worker = createBackend(
    integrationConfig({
      databaseUrl: isolatedUrl.href,
      redisUrl: process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:1',
    }),
    { logger, role: 'worker', dependencies: { storage } },
  );
  let created = false;
  try {
    await pool.query(`CREATE DATABASE ${fixtureName}`);
    created = true;
    for (const name of (await readdir(migrations)).sort()) {
      if (!/^\d{12}_/.test(name) || name >= migration) continue;
      await isolatedPool.query(
        await Bun.file(new URL(`${name}/migration.sql`, migrations)).text(),
      );
    }
    await db.anykoWorkspace.create({
      data: { id: workspaceId, name: 'Migration fixture' },
    });
    await db.documentPackageVersion.createMany({
      data: [
        {
          version: 'bfl-bankruptcy-v110',
          packageId: 'bfl-bankruptcy',
          title: 'Future BFL',
        },
        { version: 'other-v1', packageId: 'other', title: 'Unrelated package' },
      ],
    });
    await db.packageDocument.create({
      data: {
        packageVersion: 'other-v1',
        templateVersion: 'bfl-statement-v10',
        position: 0,
      },
    });
    await db.work.createMany({
      data: [
        { id: workId, packageVersion: 'bfl-bankruptcy-v11' },
        ...retained.map((packageVersion) => ({
          id: packageVersion,
          packageVersion,
        })),
        { id: 'future', packageVersion: 'bfl-bankruptcy-v110' },
        { id: 'other', packageVersion: 'other-v1' },
      ].map((work) => ({
        ...work,
        workspaceId,
        title: work.id,
        createdBy: 'test',
      })),
    });
    await db.workFacts.create({
      data: { workId, workspaceId, payload: { legacy: true } },
    });
    await db.sourceDocument.create({
      data: {
        id: sourceId,
        workspaceId,
        filename: 'source.pdf',
        sourceKey: 'source.pdf',
        sourceChecksum: 'hash',
        requestKey: 'upload',
        size: 1,
        createdBy: 'test',
      },
    });
    await db.run.createMany({
      data: [
        {
          id: queuedRunId,
          workId,
          kind: 'work.analysis',
          inputRevision: 0,
          documentIds: [sourceId],
          modelSnapshot: {},
          status: 'queued',
        },
        {
          id: 'ocr',
          documentId: sourceId,
          kind: 'document.ocr',
          revision: 1,
          status: 'succeeded',
          resultKey: 'ocr.json',
          processorVersion: 'mineru-fixture+eslav.1',
        },
      ].map((run) => ({
        ...run,
        workspaceId,
        initiatedBy: 'test',
        correlationId,
      })),
    });
    await db.workDocument.createMany({
      data: [workId, 'bfl-bankruptcy-v12'].map((id) => ({
        workId: id,
        workspaceId,
        documentId: sourceId,
        ocrRevision: 1,
        uploaded: true,
      })),
    });
    await db.idempotencyKey.create({
      data: {
        workspaceId,
        command: 'work-create',
        key: 'old-create',
        fingerprint: 'before',
        token: 'done',
        state: 'completed',
        status: 201,
        body: '{"packageVersion":"bfl-bankruptcy-v11"}',
        resourceKind: 'work',
        resourceId: workId,
        expiresAt: new Date(Date.now() + 60_000),
        lockedUntil: new Date(),
      },
    });
    await db.runOutbox.create({
      data: { id: 'delivery', workspaceId, runId: queuedRunId },
    });
    for (const generated of [
      {
        label: 'old',
        workId,
        packageVersion: 'bfl-bankruptcy-v11',
        templateVersion: 'bfl-statement-v10',
      },
      {
        label: 'retained',
        workId: 'bfl-bankruptcy-v12',
        packageVersion: 'bfl-bankruptcy-v12',
        templateVersion: 'bfl-statement-v11',
      },
    ]) {
      const { label, workId, packageVersion, templateVersion } = generated;
      await db.workGeneration.create({
        data: {
          id: label,
          workId,
          workspaceId,
          packageVersion,
          revision: 1,
          confirmed: true,
          values: {},
          status: 'succeeded',
        },
      });
      const key = `generated/${label}.docx`;
      await db.workGenerationFile.create({
        data: {
          id: label,
          generationId: label,
          workspaceId,
          workId,
          packageVersion,
          templateVersion,
          title: label,
          filename: `${label}.docx`,
          key,
          status: 'succeeded',
        },
      });
      await db.workArtifact.create({ data: { key, workspaceId, workId } });
    }
    await isolatedPool.query(
      await Bun.file(new URL(`${migration}/migration.sql`, migrations)).text(),
    );

    const tombstone = await db.work.findUniqueOrThrow({
      where: { id: workId },
    });
    expect(tombstone.deletedAt).toBeInstanceOf(Date);
    expect(
      await db.run.findUniqueOrThrow({ where: { id: queuedRunId } }),
    ).toMatchObject({ status: 'cancelled' });
    expect(
      await db.idempotencyKey.findFirstOrThrow({ where: { workspaceId } }),
    ).toMatchObject({
      state: 'resource_unavailable',
      status: null,
      body: null,
    });
    const workMaintenance = worker.jobs.registry.definitions.find(
      (entry) => entry.name === 'work.maintenance',
    );
    if (!workMaintenance || workMaintenance.kind !== 'scheduled')
      throw new Error('Missing work maintenance');
    const maintain = () => {
      const signal = new AbortController().signal;
      return workMaintenance.execute(
        { logger, clock: worker.jobs.clock, signal, correlationId },
        {},
        signal,
      );
    };

    await maintain();
    const failed = await db.workDeletion.findUniqueOrThrow({
      where: { id: workId },
    });
    expect(failed).toMatchObject({ documentIds: [], completedAt: null });
    expect(failed.failedAt).toBeInstanceOf(Date);
    expect(
      await db.workGenerationFile.findUniqueOrThrow({ where: { id: 'old' } }),
    ).toMatchObject({
      key: 'generated/old.docx',
    });
    expect(objects.has('generated/old.docx')).toBe(true);
    expect(
      await db.documentPackageVersion.findUnique({
        where: { version: 'bfl-bankruptcy-v11' },
      }),
    ).not.toBeNull();

    failStorage = false;
    await maintain();
    await maintain();

    const completed = await db.workDeletion.findUniqueOrThrow({
      where: { id: workId },
    });
    expect(completed.completedAt).toBeInstanceOf(Date);
    expect(completed.failedAt).toBeNull();
    expect(await db.workFacts.findUnique({ where: { workId } })).toBeNull();
    expect(await db.run.findUnique({ where: { id: queuedRunId } })).toBeNull();
    expect(
      await db.runOutbox.findUnique({ where: { id: 'delivery' } }),
    ).toBeNull();
    expect(
      await db.workGenerationFile.findUnique({ where: { id: 'old' } }),
    ).toBeNull();
    expect(
      await db.workArtifact.findUnique({
        where: { key: 'generated/old.docx' },
      }),
    ).toBeNull();
    expect(
      (await db.work.findMany({ orderBy: { id: 'asc' } })).map(({ id }) => id),
    ).toEqual([...retained, 'future', 'other']);
    expect(
      (
        await db.documentPackageVersion.findMany({
          where: { packageId: 'bfl-bankruptcy' },
          orderBy: { version: 'asc' },
        })
      ).map(({ version }) => version),
    ).toEqual(['bfl-bankruptcy-v110', ...retained]);
    expect(
      (
        await db.packageDocument.findMany({
          where: { packageVersion: 'other-v1' },
        })
      ).map(({ templateVersion }) => templateVersion),
    ).toEqual(['bfl-statement-v10']);
    expect(
      (
        await db.documentTemplateVersion.findMany({
          where: { version: { startsWith: 'bfl-' } },
          orderBy: { version: 'asc' },
        })
      ).map(({ version }) => version),
    ).toEqual([...retainedTemplates, 'bfl-statement-v10'].sort());
    expect(
      await db.sourceDocument.findUniqueOrThrow({ where: { id: sourceId } }),
    ).toMatchObject({ deletedAt: null });
    expect(
      await db.run.findUniqueOrThrow({ where: { id: 'ocr' } }),
    ).toMatchObject({ status: 'succeeded', resultKey: 'ocr.json' });
    expect(
      await db.workDocument.count({
        where: { documentId: sourceId, ocrRevision: 1 },
      }),
    ).toBe(1);
    expect([...objects].sort()).toEqual([
      'generated/retained.docx',
      'ocr.json',
      'source.pdf',
    ]);
  } finally {
    await worker.stop();
    await db.$disconnect();
    await isolatedPool.end();
    try {
      if (created) await pool.query(`DROP DATABASE IF EXISTS ${fixtureName}`);
    } finally {
      await pool.end();
    }
  }
});
