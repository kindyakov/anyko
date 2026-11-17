import type { Elysia } from 'elysia';

import { getSession } from '@anyko/contracts/session';

import type { Route } from '../../route';

export function sessionRoutes(route: Route, app: Elysia) {
  route(app, getSession, ({ session }) => session);
}
