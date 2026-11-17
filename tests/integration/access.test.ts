import { expect, test } from 'bun:test';

import { provisionLocalAccess } from '@anyko/backend/access';
import { type BackendConfig, createBackend } from '@anyko/backend/runtime';
import { emptyFieldValues } from '@anyko/contracts/catalog';
import { llmSettingsResponseSchema } from '@anyko/contracts/connections';
import {
  documentResponseSchema,
  documentsResponseSchema,
} from '@anyko/contracts/documents';
import {
  sessionCookieNames,
  sessionResponseSchema,
} from '@anyko/contracts/session';
import { workResponseSchema } from '@anyko/contracts/works';
import { createDatabase, createDatabasePool } from '@anyko/database';
import { createLogger } from '@anyko/logger';

import { createApp } from '../../apps/api/src/http/app';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).pathname !== '/anyko_test') {
  throw new Error('Dedicated anyko_test TEST_DATABASE_URL required');
}

// Адреса области находятся в пути (`/api/v1/workspaces/:workspaceId`): чужая область даёт 404.
const scopedRoot = '/api/v1/workspaces/local';
const sessionPath = '/api/v1/session';
const worksRoot = `${scopedRoot}/works`;
const documentsRoot = `${scopedRoot}/recognitions`;
const settingsPath = `${scopedRoot}/settings/llm`;
test('real sessions enforce closed signup, mutation origin and document workspace scope', async () => {
  const fixtureId = crypto.randomUUID();
  const emails = [
    `owner-${fixtureId}@example.test`,
    `other-${fixtureId}@example.test`,
    `blocked-${fixtureId}@example.test`,
  ];
  const firstEmail = emails[0];
  const secondEmail = emails[1];
  const blockedEmail = emails[2];
  if (!firstEmail || !secondEmail || !blockedEmail)
    throw new Error('Fixture emails missing');
  const password = `Fixture-${crypto.randomUUID()}!aA9`;
  const origin = 'http://localhost:3000';
  const config = {
    secret: crypto.randomUUID() + crypto.randomUUID(),
    baseURL: 'http://127.0.0.1:3001',
    origin,
  };
  const pool = createDatabasePool(databaseUrl);
  const db = createDatabase(pool);
  const files = new Map<string, Uint8Array>();
  const logger = createLogger({
    service: 'api',
    environment: 'test',
    release: 'access-integration',
    level: 'fatal',
  });
  // One API composition: the same pool and storage serve sessions, documents and works.
  const backendConfig: BackendConfig = {
    database: { url: databaseUrl },
    storage: {
      endpoint: 'http://127.0.0.1:1',
      bucket: 'fixture',
      accessKeyId: 'fixture',
      secretAccessKey: 'fixture',
    },
    works: {
      encryptionKey: (crypto.randomUUID() + crypto.randomUUID()).replaceAll(
        '-',
        '',
      ),
    },
    auth: {
      secret: config.secret,
      baseUrl: config.baseURL,
      origin,
    },
  };
  const api = createBackend(backendConfig, {
    logger,
    role: 'api',
    dependencies: {
      storage: {
        exists: (key) => Promise.resolve(files.has(key)),
        put(key, bytes) {
          files.set(key, bytes);
          return Promise.resolve();
        },
        get(key) {
          const bytes = files.get(key);
          if (!bytes) throw new Error('MISSING_FIXTURE');
          return Promise.resolve(bytes);
        },
        delete(key) {
          files.delete(key);
          return Promise.resolve();
        },
      },
    },
  });
  const ownedWorkIds: string[] = [];
  let ownedSettingsRevision: number | undefined;
  const app = createApp({
    workHttp: api.workHttp,
    documentHttp: api.documentHttp,
    logger,
  });
  let listening = false;
  const foreignWorkspace = `access-${fixtureId}`;
  try {
    await provisionLocalAccess({
      db,
      ...config,
      email: firstEmail,
      password,
    });
    await provisionLocalAccess({
      db,
      ...config,
      email: secondEmail,
      password,
    });
    const secondUser = await db.user.findUniqueOrThrow({
      where: { email: secondEmail },
    });
    await db.anykoWorkspace.create({
      data: { id: foreignWorkspace, name: 'Access integration fixture' },
    });
    await db.membership.deleteMany({ where: { userId: secondUser.id } });
    await db.membership.create({
      data: {
        workspaceId: foreignWorkspace,
        userId: secondUser.id,
        role: 'owner',
      },
    });
    app.listen({ hostname: '127.0.0.1', port: 0 });
    listening = true;
    const port = app.server?.port;
    if (port === undefined) throw new Error('No HTTP listener');
    const base = `http://127.0.0.1:${String(port)}`;
    const request = (path: string, init?: RequestInit) =>
      fetch(`${base}${path}`, init);
    expect((await request(sessionPath)).status).toBe(401);
    expect((await request(documentsRoot)).status).toBe(401);
    const signup = await request('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Blocked fixture',
        email: blockedEmail,
        password,
      }),
    });
    // BetterAuth reports disabled email signup as 400; the invariant is no account.
    expect(signup.status).toBe(400);
    expect(await db.user.count({ where: { email: blockedEmail } })).toBe(0);
    expect(
      await db.account.count({ where: { user: { email: blockedEmail } } }),
    ).toBe(0);
    const blockedLogin = await request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ email: blockedEmail, password }),
    });
    expect(blockedLogin.status).toBe(401);
    async function login(email: string) {
      const response = await request('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      expect(response.status).toBe(200);
      const cookies = response.headers
        .getSetCookie()
        .map((cookie) => cookie.split(';', 1)[0])
        .filter((cookie): cookie is string => Boolean(cookie));
      expect(cookies.length).toBeGreaterThan(0);
      // Web находит сессию по этим именам (proxy и серверная проверка): Better Auth должен ставить одно из них.
      const names: readonly string[] = sessionCookieNames;
      expect(
        cookies.some((cookie) => names.includes(cookie.split('=', 1)[0] ?? '')),
      ).toBe(true);
      return cookies.join('; ');
    }
    const ownerCookie = await login(firstEmail);
    const secondCookie = await login(secondEmail);
    expect((await request(worksRoot)).status).toBe(401);
    const workBody = {
      title: 'Synthetic access work',
      packageVersion: 'technical-document-v1',
    };
    const headers = {
      cookie: ownerCookie,
      origin,
      'content-type': 'application/json',
    };
    expect(
      (
        await request(worksRoot, {
          method: 'POST',
          headers: { ...headers, origin: 'https://foreign.invalid' },
          body: JSON.stringify(workBody),
        })
      ).status,
    ).toBe(403);
    // Создание работы в v1 требует Idempotency-Key (ADR 0009): без него ответ 400.
    const created = await request(worksRoot, {
      method: 'POST',
      headers: { ...headers, 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify(workBody),
    });
    expect(created.status).toBe(201);
    const work = workResponseSchema.parse(await created.json());
    ownedWorkIds.push(work.work.id);
    for (const path of [
      `${worksRoot}/${work.work.id}`,
      `${worksRoot}/${work.work.id}/events`,
      `${worksRoot}/${work.work.id}/generations/${crypto.randomUUID()}/files/${crypto.randomUUID()}`,
    ]) {
      expect(
        (await request(path, { headers: { cookie: secondCookie } })).status,
      ).toBe(404);
    }
    expect(
      (
        await request(`${worksRoot}/${work.work.id}/fields`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ revision: 0 }),
        })
      ).status,
    ).toBe(400);
    const edit = {
      revision: 0,
      values: { ...emptyFieldValues(), personName: 'Manual fixture' },
    };
    expect(
      (
        await request(`${worksRoot}/${work.work.id}/fields`, {
          method: 'POST',
          headers,
          body: JSON.stringify(edit),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(`${worksRoot}/${work.work.id}/fields`, {
          method: 'POST',
          headers,
          body: JSON.stringify(edit),
        })
      ).status,
    ).toBe(409);
    const providerKey = crypto.randomUUID();
    const connection = {
      baseURL: 'http://127.0.0.1:1/v1',
      visionModel: 'fixture',
      extractionModel: 'fixture',
      apiKey: providerKey,
    };
    expect(
      (
        await request(settingsPath, {
          method: 'POST',
          headers,
          body: JSON.stringify(connection),
        })
      ).status,
    ).toBe(200);
    const settingsText = await (
      await request(settingsPath, {
        headers: { cookie: ownerCookie },
      })
    ).text();
    expect(settingsText).not.toContain(providerKey);
    const settings = llmSettingsResponseSchema.parse(
      JSON.parse(settingsText) as unknown,
    );
    expect(settings.canManage).toBe(true);
    ownedSettingsRevision = settings.settings?.revision;
    const firstUser = await db.user.findUniqueOrThrow({
      where: { email: firstEmail },
    });
    await db.membership.update({
      where: {
        workspaceId_userId: { workspaceId: 'local', userId: firstUser.id },
      },
      data: { role: 'member' },
    });
    expect(
      (
        await request(settingsPath, {
          method: 'POST',
          headers,
          body: JSON.stringify(connection),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(sessionPath, {
          headers: { cookie: ownerCookie },
        })
      ).status,
    ).toBe(200);
    function uploadBody() {
      const body = new FormData();
      body.set(
        'file',
        new File(['%PDF-1.7\nSynthetic access fixture'], 'fixture.pdf', {
          type: 'application/pdf',
        }),
      );
      return body;
    }
    const noOrigin = await request(documentsRoot, {
      method: 'POST',
      headers: {
        cookie: ownerCookie,
        'idempotency-key': crypto.randomUUID(),
      },
      body: uploadBody(),
    });
    expect(noOrigin.status).toBe(403);
    const wrongOrigin = await request(documentsRoot, {
      method: 'POST',
      headers: {
        cookie: ownerCookie,
        origin: 'https://foreign.invalid',
        'idempotency-key': crypto.randomUUID(),
      },
      body: uploadBody(),
    });
    expect(wrongOrigin.status).toBe(403);
    const accepted = await request(documentsRoot, {
      method: 'POST',
      headers: {
        cookie: ownerCookie,
        origin,
        'idempotency-key': crypto.randomUUID(),
      },
      body: uploadBody(),
    });
    expect(accepted.status).toBe(202);
    const uploaded = documentResponseSchema.parse(await accepted.json());
    expect(uploaded.document.filename).toBe('fixture.pdf');
    expect(uploaded.document.status).toBe('queued');
    expect(
      (
        await request(`${documentsRoot}/${uploaded.document.id}`, {
          headers: { cookie: ownerCookie },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(`${documentsRoot}/${uploaded.document.id}`, {
          headers: { cookie: secondCookie },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(`${documentsRoot}/${uploaded.document.id}/result`, {
          headers: { cookie: secondCookie },
        })
      ).status,
    ).toBe(404);
    // Участник только чужой области: локальная область для него не существует (404).
    const secondLocal = await request(documentsRoot, {
      headers: { cookie: secondCookie },
    });
    expect(secondLocal.status).toBe(404);
    const foreignDocumentsPath = `/api/v1/workspaces/${foreignWorkspace}/recognitions`;
    const foreignList = await request(foreignDocumentsPath, {
      headers: { cookie: secondCookie },
    });
    expect(foreignList.status).toBe(200);
    expect(
      documentsResponseSchema.parse(await foreignList.json()).documents,
    ).toEqual([]);
    const documentPath = `${documentsRoot}/${uploaded.document.id}`;
    expect(
      (
        await request(`${documentPath}/images/0`, {
          headers: { cookie: secondCookie },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(documentPath, {
          method: 'DELETE',
          headers: { cookie: ownerCookie },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(documentPath, {
          method: 'DELETE',
          headers: { cookie: secondCookie, origin },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(documentPath, {
          method: 'DELETE',
          headers: { cookie: ownerCookie, origin },
        })
      ).status,
    ).toBe(202);
    expect(
      (await request(documentPath, { headers: { cookie: ownerCookie } }))
        .status,
    ).toBe(404);
    expect(
      (
        await request(`${documentPath}/images/0`, {
          headers: { cookie: ownerCookie },
        })
      ).status,
    ).toBe(404);
    const ownerAfterDelete = documentsResponseSchema.parse(
      await (
        await request(documentsRoot, {
          headers: { cookie: ownerCookie },
        })
      ).json(),
    );
    expect(ownerAfterDelete.documents).toEqual([]);
    expect(
      ownerAfterDelete.deletions.map(({ id, status }) => ({ id, status })),
    ).toEqual([
      {
        id: uploaded.document.id,
        status: 'deleting',
      },
    ]);
    const foreignAfterDelete = documentsResponseSchema.parse(
      await (
        await request(foreignDocumentsPath, {
          headers: { cookie: secondCookie },
        })
      ).json(),
    );
    expect(foreignAfterDelete.deletions).toEqual([]);
    // Документ работы адресуется через свою работу: документ, не связанный с ней, — 404.
    expect(
      (
        await request(
          `${worksRoot}/${work.work.id}/documents/${uploaded.document.id}/source`,
          { headers: { cookie: ownerCookie } },
        )
      ).status,
    ).toBe(404);
    // Участие второго пользователя удалено: сессия без участий отвечает 200 с пустым списком.
    await db.membership.deleteMany({ where: { userId: secondUser.id } });
    const emptySession = await request(sessionPath, {
      headers: { cookie: secondCookie },
    });
    expect(emptySession.status).toBe(200);
    expect(
      sessionResponseSchema.parse(await emptySession.json()).memberships,
    ).toEqual([]);
    // Роль member не получает права управления подключениями; сессия отражает текущее право.
    const ownerSession = sessionResponseSchema.parse(
      await (
        await request(sessionPath, {
          headers: { cookie: ownerCookie },
        })
      ).json(),
    );
    const local = ownerSession.memberships.find(
      (item) => item.workspace.id === 'local',
    );
    expect(local?.rights).toContain('works.edit');
    expect(local?.rights).not.toContain('connections.manage');
  } finally {
    if (listening) await app.stop();
    try {
      const users = await db.user.findMany({
        where: { email: { in: emails } },
        select: { id: true },
      });
      const userIds = users.map((user) => user.id);
      await db.work.deleteMany({ where: { id: { in: ownedWorkIds } } });
      if (ownedSettingsRevision !== undefined)
        await db.llmSettings.deleteMany({
          where: { workspaceId: 'local', revision: ownedSettingsRevision },
        });
      const ownedDocuments = await db.sourceDocument.findMany({
        where: { createdBy: { in: userIds } },
        select: { id: true },
      });
      const documentIds = ownedDocuments.map((document) => document.id);
      await db.documentIo.deleteMany({
        where: { documentId: { in: documentIds } },
      });
      await db.documentArtifact.deleteMany({
        where: { documentId: { in: documentIds } },
      });
      await db.processorAttempt.deleteMany({
        where: { documentId: { in: documentIds } },
      });
      await db.documentDeletion.deleteMany({
        where: { id: { in: documentIds } },
      });
      await db.processingRun.deleteMany({
        where: { documentId: { in: documentIds } },
      });
      await db.sourceDocument.deleteMany({
        where: { id: { in: documentIds } },
      });
      await db.sourceUpload.deleteMany({
        where: { key: { in: [...files.keys()] } },
      });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
      await db.auditEvent.deleteMany({
        where: { workspaceId: foreignWorkspace },
      });
      await db.anykoWorkspace.deleteMany({ where: { id: foreignWorkspace } });
    } finally {
      await api.stop();
      await db.$disconnect();
      await pool.end();
    }
  }
}, 30000);
