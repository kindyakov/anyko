import type { AccessSession, createAccess } from '@anyko/backend/access';
import { scopeFor } from '@anyko/backend/access';
import { rightCatalog } from '@anyko/backend/scope';

// Участник локальной области с полным набором прав. Сессия есть только у запроса с cookie session=ok.
const memberSession: AccessSession = {
  user: { id: 'member-1', name: 'Member', email: 'member@example.test' },
  memberships: [
    { workspace: { id: 'local', name: 'Local' }, rights: [...rightCatalog] },
  ],
};

export const memberAccess: ReturnType<typeof createAccess> = {
  handle: () => Promise.resolve(new Response(null, { status: 404 })),
  session: (headers: Headers) =>
    Promise.resolve(
      headers.get('cookie') === 'session=ok' ? memberSession : null,
    ),
  scope: scopeFor,
};
