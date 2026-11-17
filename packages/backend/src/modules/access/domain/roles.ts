import { type Right, rightCatalog } from '../../../platform/scope';

// Роли фиксированы в коде (ADR 0009): owner получает все права, member — все, кроме управления
// подключениями и приглашения участников. Неизвестная роль не даёт прав.
const ownerOnlyRights: readonly Right[] = [
  'connections.manage',
  'members.invite',
];

export function rightsForRole(role: string): readonly Right[] {
  if (role === 'owner') return rightCatalog;
  if (role === 'member')
    return rightCatalog.filter((right) => !ownerOnlyRights.includes(right));
  return [];
}
