import type { Elysia } from 'elysia';

import { endpoint, json } from '@anyko/contracts/common';
import { legacySessionResponseSchema } from '@anyko/contracts/session';

import type { Route } from '../route';

// Временно (удаляется вместе с web #11): прежний `/api/session` с первым участием.
// Описание живёт здесь, а не в contracts, чтобы не попасть в реестр v1.
const legacyGetSession = endpoint({
  method: 'GET',
  path: '/session',
  response: json(legacySessionResponseSchema),
  status: 200,
  errors: [],
});

export function legacySessionRoutes(route: Route, app: Elysia) {
  route(app, legacyGetSession, ({ session, scope }) => {
    const membership = session.memberships.find(
      (item) => item.workspace.id === scope?.workspaceId,
    );
    if (!membership) throw new Error('LEGACY_WORKSPACE_MISSING');
    return { user: session.user, workspace: membership.workspace };
  });
}
