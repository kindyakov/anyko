import { afterAll, expect, test } from 'bun:test';

import { createDatabase, createDatabasePool } from '@anyko/database';
import { createLogger } from '@anyko/logger';

import type { AuditWriter } from '../../src/modules/audit';
import type { SourceStorage } from '../../src/modules/documents';
import { brandWorkId } from '../../src/platform/ids';
import { createBackend } from '../../src/runtime';
import { integrationConfig } from '../support/composition';
import { memberScope } from '../support/scope';

// Единица работы: сбой внутри uow.run откатывает записи всех модулей, которые были сделаны в ней.
// Сценарий — старт генерации: результат, запуск, событие и журнал пишутся в одной транзакции.

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).pathname !== '/anyko_test')
  throw new Error('Dedicated anyko_test TEST_DATABASE_URL required');
const redisUrl = process.env.TEST_REDIS_URL;
if (!redisUrl) throw new Error('TEST_REDIS_URL required');
const pool = createDatabasePool(databaseUrl);
const db = createDatabase(pool);
const logger = createLogger({
  service: 'api',
  environment: 'test',
  release: 'unit-of-work-integration',
  level: 'error',
});
// Исходники и внешние вызовы в этом сценарии не используются.
const unusedStorage: SourceStorage = {
  exists: () => Promise.reject(new Error('STORAGE_UNUSED')),
  put: () => Promise.reject(new Error('STORAGE_UNUSED')),
  get: () => Promise.reject(new Error('STORAGE_UNUSED')),
  delete: () => Promise.reject(new Error('STORAGE_UNUSED')),
};
const failingAudit: AuditWriter = () =>
  Promise.reject(new Error('SYNTHETIC_AUDIT_FAILURE'));

const config = integrationConfig({
  databaseUrl,
  redisUrl,
  encryptionKey: 'e'.repeat(64),
});
const failing = createBackend(config, {
  logger,
  role: 'api',
  dependencies: { storage: unusedStorage, auditWriter: failingAudit },
});
const normal = createBackend(config, {
  logger,
  role: 'api',
  dependencies: { storage: unusedStorage },
});
const owned: string[] = [];

async function workspaceWithWork() {
  const workspaceId = crypto.randomUUID();
  owned.push(workspaceId);
  await db.anykoWorkspace.create({
    data: { id: workspaceId, name: 'Synthetic unit of work' },
  });
  const scope = memberScope(workspaceId, 'fixture');
  const workId = await normal.workHttp.intake.createWork(scope, {
    title: 'Синтетическая работа',
    packageVersion: 'technical-document-v1',
  });
  const view = await normal.workHttp.views.get(scope, workId);
  return { workspaceId, workId, revision: view.work.revision };
}

async function rejects(operation: Promise<unknown>, message: string) {
  let caught: unknown;
  try {
    await operation;
  } catch (error) {
    caught = error;
  }
  expect(caught).toMatchObject({ message });
}

afterAll(async () => {
  await failing.stop();
  await normal.stop();
  const where = { workspaceId: { in: owned } };
  await db.workGenerationFile.deleteMany({ where });
  await db.workGeneration.deleteMany({ where });
  await db.workEvent.deleteMany({ where });
  await db.run.deleteMany({ where });
  await db.work.deleteMany({ where });
  await db.auditEvent.deleteMany({ where });
  await db.anykoWorkspace.deleteMany({ where: { id: { in: owned } } });
  await db.$disconnect();
  await pool.end();
});

test('a failed audit write rolls back the generation result, the run and the event with the action', async () => {
  const { workspaceId, workId, revision } = await workspaceWithWork();
  const scope = memberScope(workspaceId, 'fixture');
  await rejects(
    failing.workHttp.generation.startGeneration(scope, {
      workId: brandWorkId(workId),
      revision,
      correlationId: crypto.randomUUID(),
    }),
    'SYNTHETIC_AUDIT_FAILURE',
  );
  expect(
    await db.workGeneration.count({ where: { workspaceId, workId } }),
  ).toBe(0);
  expect(
    await db.workGenerationFile.count({ where: { workspaceId, workId } }),
  ).toBe(0);
  expect(await db.run.count({ where: { workspaceId, workId } })).toBe(0);
  expect(
    await db.workEvent.count({
      where: { workspaceId, workId, kind: 'generation.queued' },
    }),
  ).toBe(0);
  expect(await db.auditEvent.count({ where: { workspaceId } })).toBe(0);
});

test('the same start with a working audit writes the result, the run, the event and the journal together', async () => {
  const { workspaceId, workId, revision } = await workspaceWithWork();
  const scope = memberScope(workspaceId, 'fixture');
  await normal.workHttp.generation.startGeneration(scope, {
    workId: brandWorkId(workId),
    revision,
    correlationId: crypto.randomUUID(),
  });
  expect(
    await db.workGeneration.count({ where: { workspaceId, workId } }),
  ).toBe(1);
  expect(await db.run.count({ where: { workspaceId, workId } })).toBe(1);
  expect(
    await db.workEvent.count({
      where: { workspaceId, workId, kind: 'generation.queued' },
    }),
  ).toBe(1);
  expect(
    await db.auditEvent.count({
      where: { workspaceId, action: 'generation.started' },
    }),
  ).toBe(1);
});
