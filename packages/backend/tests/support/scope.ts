import { type AccessSession, scopeFor } from '../../src/modules/access';
import { type Right, rightCatalog } from '../../src/platform/scope';

// Область участника тестовой области: участие создаёт тест, scope выдаёт модуль access.
// По умолчанию права полные; тест отказа по праву передаёт урезанный набор.
export function memberScope(
  workspaceId: string,
  userId = 'synthetic-actor',
  rights: readonly Right[] = rightCatalog,
) {
  const session: AccessSession = {
    user: {
      id: userId,
      name: 'Synthetic',
      email: 'synthetic@example.test',
    },
    memberships: [
      {
        workspace: { id: workspaceId, name: 'Synthetic' },
        rights: [...rights],
      },
    ],
  };
  const scope = scopeFor(session, workspaceId);
  if (!scope) throw new Error('SYNTHETIC_SCOPE_UNAVAILABLE');
  return scope;
}
