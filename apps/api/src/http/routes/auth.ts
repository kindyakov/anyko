import { Elysia } from 'elysia';

import type { createAccess } from '@anyko/backend/access';

// Better Auth владеет своими путями; API не описывает их endpoint-описанием.
export function authRoutes(access: ReturnType<typeof createAccess>) {
  return new Elysia().all(
    '/api/auth/*',
    ({ request }) => access.handle(request),
    {
      parse: 'none',
    },
  );
}
