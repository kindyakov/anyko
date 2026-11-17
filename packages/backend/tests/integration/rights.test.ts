import { afterAll, expect, test } from 'bun:test';

import { createDatabase, createDatabasePool } from '@anyko/database';
import { createLogger } from '@anyko/logger';

import type { SourceStorage } from '../../src/modules/documents';
import { brandDocumentId, brandWorkId } from '../../src/platform/ids';
import { createBackend } from '../../src/runtime';
import { integrationConfig } from '../support/composition';
import { memberScope } from '../support/scope';

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
  release: 'rights-integration',
  level: 'error',
});
// Права проверяются до любого обращения к хранилищу: в этом тесте хранилище не используется.
const unusedStorage: SourceStorage = {
  exists: () => Promise.reject(new Error('STORAGE_UNUSED')),
  put: () => Promise.reject(new Error('STORAGE_UNUSED')),
  get: () => Promise.reject(new Error('STORAGE_UNUSED')),
  delete: () => Promise.reject(new Error('STORAGE_UNUSED')),
};
const api = createBackend(
  integrationConfig({
    databaseUrl,
    redisUrl,
    encryptionKey: 'c'.repeat(64),
  }),
  { logger, role: 'api', dependencies: { storage: unusedStorage } },
);
const owned: string[] = [];
async function workspace() {
  const id = crypto.randomUUID();
  await db.anykoWorkspace.create({
    data: { id, name: 'Synthetic rights' },
  });
  owned.push(id);
  return id;
}
async function expectForbidden(operation: Promise<unknown>) {
  let caught: unknown;
  try {
    await operation;
  } catch (error) {
    caught = error;
  }
  expect(caught).toMatchObject({ code: 'FORBIDDEN', kind: 'forbidden' });
}

afterAll(async () => {
  await db.work.deleteMany({ where: { workspaceId: { in: owned } } });
  await db.anykoWorkspace.deleteMany({ where: { id: { in: owned } } });
  await api.stop();
  await db.$disconnect();
  await pool.end();
});

test('a scope without a right is refused by the work scenario and nothing is written', async () => {
  const ws = await workspace();
  const owner = memberScope(ws, 'owner-user');
  const created = await api.workHttp.works.create(owner, {
    title: 'Rights fixture',
    packageVersion: 'technical-document-v1',
  });
  const workId = brandWorkId(created.work.id);
  const reader = memberScope(ws, 'reader-user', ['works.read']);
  // Чтение доступно по works.read; изменения требуют своих прав.
  expect((await api.workHttp.works.get(reader, workId)).work.id).toBe(
    created.work.id,
  );
  await expectForbidden(
    api.workHttp.works.create(reader, {
      title: 'Refused',
      packageVersion: 'technical-document-v1',
    }),
  );
  await expectForbidden(
    api.workHttp.works.confirm(reader, {
      workId,
      revision: created.work.revision,
    }),
  );
  await expectForbidden(
    api.workHttp.works.generate(reader, {
      workId,
      revision: created.work.revision,
      correlationId: crypto.randomUUID(),
    }),
  );
  await expectForbidden(
    api.workHttp.works.analyze(reader, {
      workId,
      correlationId: crypto.randomUUID(),
    }),
  );
  // Удаление исходника требует documents.delete: проверка идёт до поиска документа.
  await expectForbidden(
    api.workHttp.works.removeDocument(reader, {
      workId,
      documentId: brandDocumentId(crypto.randomUUID()),
    }),
  );
  expect(await db.work.count({ where: { workspaceId: ws } })).toBe(1);
  expect((await api.workHttp.works.get(owner, workId)).work.revision).toBe(
    created.work.revision,
  );
});

test('connection settings and recognitions are guarded by their own rights', async () => {
  const ws = await workspace();
  const writer = memberScope(ws, 'writer-user', ['works.read']);
  await expectForbidden(
    api.workHttp.settings.save(writer, {
      baseURL: 'http://127.0.0.1:1/v1',
      visionModel: 'fixture',
      extractionModel: 'fixture',
      apiKey: 'fixture-key',
    }),
  );
  expect(await db.llmSettings.count({ where: { workspaceId: ws } })).toBe(0);
  await expectForbidden(
    api.workHttp.settings.current(memberScope(ws, 'nobody', [])),
  );
  const reader = memberScope(ws, 'reader-user', ['connections.read']);
  expect(await api.workHttp.settings.current(reader)).toEqual({
    settings: null,
    canManage: false,
  });
  await expectForbidden(
    api.documentHttp.documents.list(
      memberScope(ws, 'works-only', ['works.read']),
    ),
  );
  expect(
    await api.documentHttp.documents.list(
      memberScope(ws, 'user', ['recognitions.use']),
    ),
  ).toEqual([]);
});
