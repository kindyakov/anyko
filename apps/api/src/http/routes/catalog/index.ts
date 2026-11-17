import type { Elysia } from 'elysia';

import type { WorkApi } from '@anyko/backend/works';
import { listDocumentPackages } from '@anyko/contracts/catalog';

import type { Route } from '../../route';

export function catalogRoutes(
  route: Route,
  app: Elysia,
  options: Pick<WorkApi, 'packages'>,
) {
  route(app, listDocumentPackages, () => ({ packages: options.packages() }));
}
