import { Elysia } from 'elysia';

import type { Endpoint } from '@anyko/contracts/common';
import { createLogger, type Logger } from '@anyko/logger';

import { buildOpenApi } from './openapi';
import { errorHandling } from './plugins/errors';
import { noStore } from './plugins/no-store';
import { originGuard } from './plugins/origin';
import { requestContext } from './plugins/request-context';
import { sessionGuard } from './plugins/session';
import { createRoute } from './route';
import { authRoutes } from './routes/auth';
import { catalogRoutes } from './routes/catalog';
import { connectionRoutes } from './routes/connections';
import { type DocumentHttpOptions, documentRoutes } from './routes/documents';
import { sessionRoutes } from './routes/session';
import { type WorkHttpOptions, worksRoutes } from './routes/works';

export interface AppOptions {
  logger?: Logger;
  ready?: () => boolean;
  // NODE_ENV процесса: test включает строгую проверку кодов ошибок, production убирает OpenAPI.
  environment?: string;
  documentHttp?: DocumentHttpOptions;
  workHttp?: WorkHttpOptions;
}

export function createApp(options?: AppOptions) {
  const logger =
    options?.logger ??
    createLogger({
      service: 'api',
      environment: 'test',
      release: 'local',
      level: 'info',
    });
  const environment =
    options?.environment ?? process.env.NODE_ENV ?? 'development';
  const strictErrors = environment === 'test';
  // Описания, которые маршруты зарегистрировали через route(): основа OpenAPI.
  const endpoints = new Set<Endpoint>();
  const app = new Elysia();
  requestContext(app, logger);
  errorHandling(app, logger);
  // Better Auth владеет своими путями; API-описания его не покрывают.
  if (options?.documentHttp) app.use(authRoutes(options.documentHttp.access));
  if (environment !== 'production')
    app.get('/api/v1/openapi.json', () => buildOpenApi([...endpoints]));
  const api = options?.workHttp ?? options?.documentHttp;
  if (api) {
    // Один набор маршрутов под двумя префиксами. Временный префикс без версии
    // удаляется вместе с web #11.
    for (const prefix of ['/api/v1', '/api'])
      app.use(
        apiRoutes({
          prefix,
          logger,
          strictErrors,
          endpoints,
          api,
          documentHttp: options?.documentHttp,
          workHttp: options?.workHttp,
        }),
      );
  }
  return app
    .get('/health', () => ({ status: 'ok' }))
    .get('/health/live', () => ({ status: 'ok' }))
    .get('/health/ready', ({ set }) => {
      const ready = options?.ready?.() ?? true;
      if (!ready) set.status = 503;
      return { status: ready ? 'ready' : 'stopping' };
    });
}

// Hooks API живут в собственном экземпляре: они не попадают на health и на Better Auth.
function apiRoutes(input: {
  prefix: string;
  logger: Logger;
  strictErrors: boolean;
  endpoints: Set<Endpoint>;
  api: DocumentHttpOptions;
  documentHttp: DocumentHttpOptions | undefined;
  workHttp: WorkHttpOptions | undefined;
}): Elysia {
  const { api } = input;
  const route = createRoute({
    logger: input.logger,
    strictErrors: input.strictErrors,
    endpoints: input.endpoints,
    prefix: input.prefix,
  });
  const app = new Elysia();
  noStore(app);
  sessionGuard(app, api.access);
  originGuard(app, api.origin);
  sessionRoutes(route, app);
  if (input.documentHttp) documentRoutes(route, app, input.documentHttp);
  if (input.workHttp) {
    catalogRoutes(route, app, input.workHttp.works);
    worksRoutes(route, app, input.workHttp);
    connectionRoutes(route, app, input.workHttp);
  }
  return app;
}
