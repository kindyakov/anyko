import { Elysia } from 'elysia';

const app = new Elysia().get('/health', () => ({ status: 'ok' })).listen(3001);

console.info('API listening', app.server?.port);
