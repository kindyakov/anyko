import { Elysia } from 'elysia';
import type { createAccess } from '@anyko/backend/access';

export function authRoutes(access: ReturnType<typeof createAccess>) {
  return new Elysia()
    .all('/api/auth/*', ({ request }) => access.handle(request), {
      parse: 'none',
    })
    .get('/api/session', async ({ request, set }) => {
      set.headers['cache-control'] = 'no-store';
      const session = await access.session(request.headers);
      if (!session) {
        set.status = 401;
        return {
          error: {
            code: 'UNAUTHORIZED',
            requestId: set.headers['x-request-id'] ?? '',
          },
        };
      }
      return session;
    });
}
