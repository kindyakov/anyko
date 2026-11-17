import { type Right, rightCatalog } from '../../../platform/scope';

// Owner получает все права, member — права за вычетом действий владельца.
const ownerOnlyRights: readonly Right[] = [
  'works.delete',
  'connections.manage',
  'members.invite',
];

export function rightsForRole(role: string): readonly Right[] {
  if (role === 'owner') return rightCatalog;
  if (role === 'member')
    return rightCatalog.filter((right) => !ownerOnlyRights.includes(right));
  return [];
}
