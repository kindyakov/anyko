import { Elysia } from 'elysia';

export function createApp() {
  return new Elysia().get('/health', () => ({ status: 'ok' }));
}
