import { expect, test } from 'bun:test';

import { Redis } from 'ioredis';

import { createDatabase, createDatabasePool } from '@anyko/database';

import { E2E_DOCUMENT_QUEUE, parseE2eConfig } from './config';

test('preparation is repeatable and both OCR outcomes pass through the HTTP API and queue', async () => {
  const env = parseE2eConfig(process.env);
  const runPrepare = async () => {
    const process = Bun.spawn(['bun', 'tests/e2e/backend/prepare.ts'], {
      stdout: 'ignore',
      stderr: 'pipe',
    });
    const exit = await process.exited;
    if (exit !== 0)
      throw new Error(
        `E2E_PREPARE_FAILED: ${await new Response(process.stderr).text()}`,
      );
  };
  const redis = new Redis(env.E2E_REDIS_URL);
  const sentinel = `anyko-e2e-test-sentinel:${crypto.randomUUID()}`;
  const isolatedKey = `bull:${E2E_DOCUMENT_QUEUE}:fixture-check`;
  try {
    await redis.set(sentinel, 'preserve');
    await redis.set(isolatedKey, 'remove');
    await runPrepare();
    expect(await redis.get(sentinel)).toBe('preserve');
    expect(await redis.exists(isolatedKey)).toBe(0);
  } finally {
    await redis.del(sentinel);
    redis.disconnect();
  }
  const pool = createDatabasePool(env.E2E_DATABASE_URL);
  const db = createDatabase(pool);
  const snapshot = async () => ({
    users: (
      await db.user.findMany({
        select: { email: true },
        orderBy: { email: 'asc' },
      })
    ).map((user) => user.email),
    workspaces: await db.anykoWorkspace.findMany({
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    }),
    memberships: await db.membership.findMany({
      select: {
        workspaceId: true,
        role: true,
        user: { select: { email: true } },
      },
      orderBy: [{ workspaceId: 'asc' }, { role: 'asc' }],
    }),
    settings: await db.llmSettings.count(),
  });
  try {
    const before = await snapshot();
    await runPrepare();
    expect(await snapshot()).toEqual(before);
    expect(before.users).toHaveLength(3);
    expect(before.memberships).toHaveLength(3);
    expect(before.settings).toBe(2);
  } finally {
    await db.$disconnect();
    await pool.end();
  }
  const backend = Bun.spawn(['bun', 'tests/e2e/backend/start.ts'], {
    stdout: 'ignore',
    stderr: 'pipe',
  });
  const root = `http://127.0.0.1:${String(env.API_PORT)}`;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        ready = (await fetch(`${root}/health/ready`)).ok;
      } catch {
        /* startup */
      }
      if (ready) break;
      await Bun.sleep(100);
    }
    expect(ready).toBe(true);
    const signIn = async (email: string, password: string) => {
      const login = await fetch(`${root}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: env.APP_ORIGIN },
        body: JSON.stringify({ email, password }),
      });
      expect(login.status).toBe(200);
      const cookie = login.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ');
      expect(cookie.length).toBeGreaterThan(0);
      return cookie;
    };
    const cookie = await signIn(env.E2E_OWNER_EMAIL, env.E2E_OWNER_PASSWORD);
    const member = await signIn(env.E2E_MEMBER_EMAIL, env.E2E_MEMBER_PASSWORD);
    const outsider = await signIn(
      env.E2E_OUTSIDER_EMAIL,
      env.E2E_OUTSIDER_PASSWORD,
    );
    const memberships = async (sessionCookie: string) => {
      const response = await fetch(`${root}/api/v1/session`, {
        headers: { cookie: sessionCookie },
      });
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        memberships: { workspace: { id: string }; rights: string[] }[];
      };
      return body.memberships;
    };
    expect(
      (await memberships(cookie)).map((item) => item.workspace.id).sort(),
    ).toEqual(['e2e-north', 'e2e-south']);
    const memberMemberships = await memberships(member);
    expect(memberMemberships.map((item) => item.workspace.id)).toEqual([
      'e2e-north',
    ]);
    expect(memberMemberships[0]?.rights).not.toContain('connections.manage');
    expect(await memberships(outsider)).toEqual([]);
    expect(
      (
        await fetch(`${root}/api/v1/workspaces/e2e-south/recognitions`, {
          headers: { cookie: member },
        })
      ).status,
    ).toBe(404);
    for (const [filename, fixture, expected] of [
      ['source.pdf', 'source.pdf', 'succeeded'],
      ['fail.pdf', 'fail.pdf', 'failed'],
      ['fail.pdf', 'source.pdf', 'failed'],
    ] as const) {
      const form = new FormData();
      form.append(
        'file',
        new File(
          [await Bun.file(`tests/e2e/fixtures/${fixture}`).arrayBuffer()],
          filename,
          { type: 'application/pdf' },
        ),
      );
      const response = await fetch(
        `${root}/api/v1/workspaces/e2e-north/recognitions`,
        {
          method: 'POST',
          headers: {
            cookie,
            origin: env.APP_ORIGIN,
            'Idempotency-Key': crypto.randomUUID(),
          },
          body: form,
        },
      );
      expect(response.status).toBe(202);
      const uploaded = (await response.json()) as { document: { id: string } };
      let status = '';
      for (let attempt = 0; attempt < 100; attempt++) {
        const result = await fetch(
          `${root}/api/v1/workspaces/e2e-north/recognitions/${uploaded.document.id}`,
          { headers: { cookie } },
        );
        const body = (await result.json()) as { document: { status: string } };
        status = body.document.status;
        if (status === 'succeeded' || status === 'failed') break;
        await Bun.sleep(100);
      }
      expect(status).toBe(expected);
    }
  } finally {
    backend.kill();
    await backend.exited;
  }
}, 120000);
