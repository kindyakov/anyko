import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';

import { createDatabase } from '@anyko/database';

export interface AccessOptions {
  databaseUrl: string;
  secret: string;
  baseURL: string;
  origin: string;
}

function buildAuth(options: AccessOptions, provisioning = false) {
  const db = createDatabase(options.databaseUrl);
  const auth = betterAuth({
    database: prismaAdapter(db, { provider: 'postgresql', transaction: true }),
    secret: options.secret,
    baseURL: options.baseURL,
    basePath: '/api/auth',
    trustedOrigins: [options.origin],
    emailAndPassword: {
      enabled: true,
      disableSignUp: !provisioning,
      autoSignIn: false,
    },
    logger: { disabled: true },
  });
  return { db, auth };
}

export function createAccess(options: AccessOptions) {
  const { db, auth } = buildAuth(options);
  return {
    handle: (request: Request) => auth.handler(request),
    async canManage(userId: string, workspaceId: string) {
      return (
        (
          await db.membership.findUnique({
            where: { workspaceId_userId: { workspaceId, userId } },
          })
        )?.role === 'owner'
      );
    },
    async session(headers: Headers) {
      const session = await auth.api.getSession({ headers });
      if (!session) return null;
      const membership = await db.membership.findFirst({
        where: { userId: session.user.id },
        include: { workspace: true },
        orderBy: { workspaceId: 'asc' },
      });
      if (!membership) return null;
      return {
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
        },
        workspace: {
          id: membership.workspace.id,
          name: membership.workspace.name,
        },
      };
    },
    stop: () => db.$disconnect(),
  };
}

/** Explicit operator CLI only; this factory is never mounted as an HTTP handler. */
export async function provisionLocalAccess(
  options: AccessOptions & { email: string; password: string },
) {
  const { db, auth } = buildAuth(options, true);
  try {
    let user = await db.user.findUnique({ where: { email: options.email } });
    if (!user) {
      const created = await auth.api.signUpEmail({
        body: {
          email: options.email,
          password: options.password,
          name: 'Разработчик Anyko',
        },
      });
      user = await db.user.findUniqueOrThrow({
        where: { id: created.user.id },
      });
    }
    await db.anykoWorkspace.upsert({
      where: { id: 'local' },
      create: { id: 'local', name: 'Локальная команда' },
      update: {},
    });
    await db.membership.upsert({
      where: { workspaceId_userId: { workspaceId: 'local', userId: user.id } },
      create: { workspaceId: 'local', userId: user.id, role: 'owner' },
      update: {},
    });
  } finally {
    await db.$disconnect();
  }
}
