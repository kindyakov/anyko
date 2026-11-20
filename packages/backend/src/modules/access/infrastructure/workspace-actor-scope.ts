import type { Database } from '@anyko/database';

import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';
import { transactionHandle, type Tx } from '../../../platform/transactions';
import { rightsForRole } from '../domain/roles';
import { issueScope } from '../domain/scope';

type MembershipDb = Pick<Database, 'membership'>;

export type WorkspaceActorScope = (
  workspaceId: string,
  userId: string,
  tx?: Tx,
) => Promise<WorkspaceScope | null>;

export function createWorkspaceActorScope(
  db: MembershipDb,
): WorkspaceActorScope {
  return async (workspaceId, userId, tx) => {
    const member = tx
      ? await lockMembership(tx, workspaceId, userId)
      : await db.membership.findUnique({
          where: { workspaceId_userId: { workspaceId, userId } },
          select: { role: true },
        });
    return member
      ? issueScope(userId, workspaceId, rightsForRole(member.role))
      : null;
  };
}

async function lockMembership(tx: Tx, workspaceId: string, userId: string) {
  const db = transactionHandle<Pick<Database, '$queryRaw'>>(tx);
  const [member] = await db.$queryRaw<{ role: string }[]>`
    SELECT role FROM "Membership"
    WHERE "workspaceId" = ${workspaceId} AND "userId" = ${userId}
    FOR SHARE
  `;
  return member;
}
