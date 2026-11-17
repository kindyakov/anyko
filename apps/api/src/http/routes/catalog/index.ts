import type { Elysia } from 'elysia';

import type { WorkViews } from '@anyko/backend/workflows';
import { listDocumentPackages } from '@anyko/contracts/catalog';

import type { Route } from '../../route';

export function catalogRoutes(
  route: Route,
  app: Elysia,
  options: Pick<WorkViews, 'packages'>,
) {
  route(app, listDocumentPackages, () => ({ packages: options.packages() }));
}
