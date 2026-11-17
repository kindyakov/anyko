import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';

import type { Database } from '@anyko/database';

import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';
import { rightsForRole } from '../domain/roles';
import { type AccessSession, issueScope, scopeFor } from '../domain/scope';

export interface AccessOptions {
  /** Shared client owned by the composition root; access never connects or disconnects it. */
  db: Database;
  secret: string;
  baseURL: string;
  origin: string;
}

function buildAuth(options: AccessOptions, provisioning = false) {
  return betterAuth({
    database: prismaAdapter(options.db, {
      provider: 'postgresql',
      transaction: true,
    }),
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
}

export function createAccess(options: AccessOptions) {
  const { db } = options;
  const auth = buildAuth(options);
  return {
    handle: (request: Request) => auth.handler(request),
    // Сессия Better Auth без участий — тоже сессия: web получает пустой список и не зацикливается.
    async session(headers: Headers): Promise<AccessSession | null> {
      const session = await auth.api.getSession({ headers });
      if (!session) return null;
      const memberships = await db.membership.findMany({
        where: { userId: session.user.id },
        include: { workspace: true },
        orderBy: [{ workspace: { name: 'asc' } }, { workspaceId: 'asc' }],
      });
      return {
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
        },
        memberships: memberships.map((membership) => ({
          workspace: {
            id: membership.workspace.id,
            name: membership.workspace.name,
          },
          rights: [...rightsForRole(membership.role)],
        })),
      };
    },
    scope: scopeFor,
    // Временно (удаляется вместе с web #11): первое участие по workspaceId, как прежний маршрут
    // без области в адресе.
    async legacyScope(userId: string): Promise<WorkspaceScope | null> {
      const membership = await db.membership.findFirst({
        where: { userId },
        orderBy: { workspaceId: 'asc' },
      });
      if (!membership) return null;
      return issueScope(
        userId,
        membership.workspaceId,
        rightsForRole(membership.role),
      );
    },
  };
}

/** Explicit operator CLI only; this factory is never mounted as an HTTP handler. */
export async function provisionLocalAccess(
  options: AccessOptions & { email: string; password: string },
) {
  const { db } = options;
  const auth = buildAuth(options, true);
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
}
