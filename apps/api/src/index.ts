import { createApp } from './app';

const app = createApp().listen(3001);

console.info('API listening', app.server?.port);
