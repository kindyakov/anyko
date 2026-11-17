import { afterAll, expect, test } from 'bun:test';

import { createDatabase, createDatabasePool } from '@anyko/database';
import { createLogger } from '@anyko/logger';

import { grantMembership } from '../../src/modules/access/infrastructure/auth';
import { type AuditWriter, record } from '../../src/modules/audit';
import { type ApiBackend, createBackend } from '../../src/runtime';
import { createDocumentUnitOfWork } from '../../src/runtime/documents/unit-of-work';
import { integrationConfig } from '../support/composition';
import { memberScope } from '../support/scope';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).pathname !== '/anyko_test')
  throw new Error('Dedicated anyko_test TEST_DATABASE_URL required');
const pool = createDatabasePool(databaseUrl);
const db = createDatabase(pool);
const encryptionKey = 'd'.repeat(64);
const apiKey = 'synthetic-secret-api-key';

const settingsBackends: ApiBackend[] = [];
function connectionApi(write: AuditWriter = record) {
  const api = createBackend(
    integrationConfig({
      databaseUrl: databaseUrl ?? '',
      redisUrl: 'redis://127.0.0.1:1',
      encryptionKey,
    }),
    {
      role: 'api',
      logger: createLogger({
        service: 'api',
        environment: 'test',
        release: 'audit',
        level: 'fatal',
      }),
      dependencies: { auditWriter: write },
    },
  );
  settingsBackends.push(api);
  return api.workHttp.settings;
}
const owned: string[] = [];
const users: string[] = [];

async function newUser() {
  const userId = crypto.randomUUID();
  users.push(userId);
  await db.user.create({
    data: {
      id: userId,
      name: 'Synthetic member',
      email: `${userId}@example.test`,
    },
  });
  return userId;
}

async function workspace() {
  const id = crypto.randomUUID();
  await db.anykoWorkspace.create({ data: { id, name: 'Synthetic audit' } });
  owned.push(id);
  return id;
}

// Событие с отказом записи: действие должно откатиться вместе с ним.
const failingWrite: AuditWriter = () =>
  Promise.reject(new Error('SYNTHETIC_AUDIT_FAILURE'));

async function expectRejected(operation: Promise<unknown>) {
  let caught: unknown;
  try {
    await operation;
  } catch (error) {
    caught = error;
  }
  expect(caught).toMatchObject({ message: 'SYNTHETIC_AUDIT_FAILURE' });
}

afterAll(async () => {
  for (const backend of settingsBackends) await backend.stop();
  await db.auditEvent.deleteMany({ where: { workspaceId: { in: owned } } });
  await db.llmSettings.deleteMany({ where: { workspaceId: { in: owned } } });
  await db.documentDeletion.deleteMany({
    where: { workspaceId: { in: owned } },
  });
  await db.membership.deleteMany({ where: { workspaceId: { in: owned } } });
  await db.sourceDocument.deleteMany({
    where: { workspaceId: { in: owned } },
  });
  await db.anykoWorkspace.deleteMany({ where: { id: { in: owned } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
  await pool.end();
});

test('saving connection settings records the revision and never the API key', async () => {
  const ws = await workspace();
  const store = connectionApi();
  await store.save(memberScope(ws, 'settings-actor'), {
    baseURL: 'http://127.0.0.1:1/v1',
    visionModel: 'fixture',
    extractionModel: 'fixture',
    apiKey,
  });
  const events = await db.auditEvent.findMany({ where: { workspaceId: ws } });
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    action: 'connections.settings_saved',
    actorId: 'settings-actor',
    targetKind: 'workspace',
    targetId: ws,
    data: { revision: 1 },
  });
  // Ключ не попадает ни в данные события, ни в строку журнала целиком.
  expect(JSON.stringify(events)).not.toContain(apiKey);
});

test('a failed audit write rolls back the settings change with it', async () => {
  const ws = await workspace();
  const store = connectionApi(failingWrite);
  await expectRejected(
    store.save(memberScope(ws, 'settings-actor'), {
      baseURL: 'http://127.0.0.1:1/v1',
      visionModel: 'fixture',
      extractionModel: 'fixture',
      apiKey,
    }),
  );
  expect(await db.llmSettings.count({ where: { workspaceId: ws } })).toBe(0);
  expect(await db.auditEvent.count({ where: { workspaceId: ws } })).toBe(0);
});

test('granting a membership records the grant with no actor for the operator command', async () => {
  const ws = await workspace();
  const userId = await newUser();
  await grantMembership(db, { workspaceId: ws, userId, role: 'owner' });
  expect(
    await db.membership.count({ where: { workspaceId: ws, userId } }),
  ).toBe(1);
  const events = await db.auditEvent.findMany({ where: { workspaceId: ws } });
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    action: 'access.membership_granted',
    actorId: null,
    targetKind: 'user',
    targetId: userId,
    data: { role: 'owner' },
  });
});

test('a failed audit write leaves no membership behind', async () => {
  const ws = await workspace();
  const userId = await newUser();
  await expectRejected(
    grantMembership(
      db,
      { workspaceId: ws, userId, role: 'member' },
      failingWrite,
    ),
  );
  expect(
    await db.membership.count({ where: { workspaceId: ws, userId } }),
  ).toBe(0);
});

test('deleting a document records one event, and a repeat delete records nothing', async () => {
  const ws = await workspace();
  const documentId = crypto.randomUUID();
  await db.sourceDocument.create({
    data: {
      id: documentId,
      workspaceId: ws,
      filename: 'synthetic.pdf',
      sourceKey: `sources/${ws}/${documentId}.pdf`,
      sourceChecksum: 'a'.repeat(64),
      requestKey: crypto.randomUUID(),
      size: 4,
      createdBy: 'synthetic-actor',
    },
  });
  const documents = createDocumentUnitOfWork(db);
  expect(await documents.remove(ws, documentId, 'delete-actor')).toBe(true);
  expect(await documents.remove(ws, documentId, 'delete-actor')).toBe(true);
  const events = await db.auditEvent.findMany({
    where: { workspaceId: ws, action: 'documents.deleted' },
  });
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    actorId: 'delete-actor',
    targetKind: 'document',
    targetId: documentId,
    data: null,
  });
});

test('an audit event written in a transaction disappears with the rolled back action', async () => {
  const ws = await workspace();
  await expectRejected(
    db.$transaction(async (tx) => {
      await record(tx, {
        workspaceId: ws,
        actorId: 'rollback-actor',
        action: 'connections.settings_saved',
        target: { kind: 'workspace', id: ws },
        data: { revision: 9 },
      });
      throw new Error('SYNTHETIC_AUDIT_FAILURE');
    }),
  );
  expect(await db.auditEvent.count({ where: { workspaceId: ws } })).toBe(0);
});
