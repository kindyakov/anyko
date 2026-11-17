import type { Elysia } from 'elysia';

// Ответы API с данными пользователя не кэшируются; ставится до сессии, чтобы и 401 его нёс.
export function noStore(app: Elysia): void {
  app.onBeforeHandle(({ set }) => {
    set.headers['cache-control'] = 'no-store';
  });
}
