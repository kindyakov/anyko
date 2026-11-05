import { expect, test } from 'bun:test';
import { createDatabase } from '@anyko/database';
import { createAccess, provisionLocalAccess } from '@anyko/backend/access';
import { createDocumentRuntime } from '@anyko/backend/runtime';
import { createLogger } from '@anyko/logger';
import {
  documentResponseSchema,
  documentsResponseSchema,
} from '@anyko/contracts';
import { createApp } from '../../apps/api/src/http/app';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).pathname !== '/anyko_test') {
  throw new Error('Dedicated anyko_test TEST_DATABASE_URL required');
}

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
    databaseUrl,
    secret: crypto.randomUUID() + crypto.randomUUID(),
    baseURL: 'http://127.0.0.1:3001',
    origin,
  };
  const db = createDatabase(databaseUrl);
  const access = createAccess(config);
  const files = new Map<string, Uint8Array>();
  const documents = createDocumentRuntime({
    databaseUrl,
    logger: createLogger({
      service: 'api',
      environment: 'test',
      release: 'access-integration',
      level: 'fatal',
    }),
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
  });
  const app = createApp({
    documentHttp: { access, documents, origin },
    logger: createLogger({
      service: 'api',
      environment: 'test',
      release: 'access-integration',
      level: 'fatal',
    }),
  });
  let listening = false;
  const foreignWorkspace = `access-${fixtureId}`;
  try {
    await provisionLocalAccess({ ...config, email: firstEmail, password });
    await provisionLocalAccess({ ...config, email: secondEmail, password });
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
    expect((await request('/api/session')).status).toBe(401);
    expect((await request('/api/documents')).status).toBe(401);
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
      return cookies.join('; ');
    }
    const ownerCookie = await login(firstEmail);
    const secondCookie = await login(secondEmail);
    expect(
      (await request('/api/session', { headers: { cookie: ownerCookie } }))
        .status,
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
    const noOrigin = await request('/api/documents', {
      method: 'POST',
      headers: { cookie: ownerCookie, 'idempotency-key': crypto.randomUUID() },
      body: uploadBody(),
    });
    expect(noOrigin.status).toBe(403);
    const wrongOrigin = await request('/api/documents', {
      method: 'POST',
      headers: {
        cookie: ownerCookie,
        origin: 'https://foreign.invalid',
        'idempotency-key': crypto.randomUUID(),
      },
      body: uploadBody(),
    });
    expect(wrongOrigin.status).toBe(403);
    const accepted = await request('/api/documents', {
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
        await request(`/api/documents/${uploaded.document.id}`, {
          headers: { cookie: ownerCookie },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(`/api/documents/${uploaded.document.id}`, {
          headers: { cookie: secondCookie },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(`/api/documents/${uploaded.document.id}/result`, {
          headers: { cookie: secondCookie },
        })
      ).status,
    ).toBe(404);
    const foreignList = await request('/api/documents', {
      headers: { cookie: secondCookie },
    });
    expect(foreignList.status).toBe(200);
    expect(
      documentsResponseSchema.parse(await foreignList.json()).documents,
    ).toEqual([]);
    const documentPath = `/api/documents/${uploaded.document.id}`;
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
        await request('/api/documents', {
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
        await request('/api/documents', {
          headers: { cookie: secondCookie },
        })
      ).json(),
    );
    expect(foreignAfterDelete.deletions).toEqual([]);
  } finally {
    if (listening) await app.stop();
    try {
      const users = await db.user.findMany({
        where: { email: { in: emails } },
        select: { id: true },
      });
      const userIds = users.map((user) => user.id);
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
      await db.anykoWorkspace.deleteMany({ where: { id: foreignWorkspace } });
    } finally {
      await Promise.all([documents.stop(), access.stop(), db.$disconnect()]);
    }
  }
}, 30000);
