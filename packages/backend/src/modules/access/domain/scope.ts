import { parseUserId, parseWorkspaceId } from '../../../platform/ids';
import type { Right } from '../../../platform/scope';
import { issueWorkspaceScope } from '../../../platform/scope/issue';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

// Сессия пользователя и все его участия с правами каждого участия. Роль не возвращается.
export interface AccessSession {
  user: { id: string; name: string; email: string };
  memberships: {
    workspace: { id: string; name: string };
    rights: Right[];
  }[];
}

// Выдача области по проверенному участию. Идентификаторы без формата не превращаются в область.
export function issueScope(
  userId: string,
  workspaceId: string,
  rights: readonly Right[],
): WorkspaceScope | null {
  const user = parseUserId(userId);
  const workspace = parseWorkspaceId(workspaceId);
  if (!user || !workspace) return null;
  return issueWorkspaceScope({ userId: user, workspaceId: workspace, rights });
}

// Область из адреса: только участие в ней даёт scope. Чужая или несуществующая область — null.
export function scopeFor(
  session: AccessSession,
  workspaceId: string,
): WorkspaceScope | null {
  const membership = session.memberships.find(
    (item) => item.workspace.id === workspaceId,
  );
  if (!membership) return null;
  return issueScope(
    session.user.id,
    membership.workspace.id,
    membership.rights,
  );
}
