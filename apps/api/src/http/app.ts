import { Elysia } from 'elysia';

import type { Endpoint } from '@anyko/contracts/common';
import { createLogger, type Logger } from '@anyko/logger';

import { legacyLayer } from './legacy/paths';
import { legacyWorkspaceScopeGuard } from './legacy/scope';
import { legacySessionRoutes } from './legacy/session';
import { buildOpenApi } from './openapi';
import { errorHandling } from './plugins/errors';
import { noStore } from './plugins/no-store';
import { originGuard } from './plugins/origin';
import { requestContext } from './plugins/request-context';
import { sessionGuard } from './plugins/session';
import { workspaceScopeGuard } from './plugins/workspace-scope';
import { createRoute, type Route, versionedLayer } from './route';
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
    const input = {
      logger,
      strictErrors,
      api,
      documentHttp: options?.documentHttp,
      workHttp: options?.workHttp,
    };
    app.use(versionedRoutes({ ...input, endpoints }));
    // Временный слой без версии (web #11): те же обработчики, другой адрес и источник области.
    app.use(legacyRoutes(input));
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

interface ApiInput {
  logger: Logger;
  strictErrors: boolean;
  api: DocumentHttpOptions;
  documentHttp: DocumentHttpOptions | undefined;
  workHttp: WorkHttpOptions | undefined;
}

// Hooks API живут в собственном экземпляре: они не попадают на health и на Better Auth.
// Порядок hooks: сессия → origin → область → разбор входа (внутри route()).
function versionedRoutes(input: ApiInput & { endpoints: Set<Endpoint> }) {
  const route = createRoute({
    layer: versionedLayer,
    logger: input.logger,
    strictErrors: input.strictErrors,
    endpoints: input.endpoints,
  });
  const app = new Elysia();
  noStore(app);
  sessionGuard(app, input.api.access);
  originGuard(app, input.api.origin);
  workspaceScopeGuard(app, input.api.access);
  sessionRoutes(route, app);
  registerScopedRoutes(route, app, input);
  return app;
}

function legacyRoutes(input: ApiInput) {
  const route = createRoute({
    layer: legacyLayer,
    logger: input.logger,
    strictErrors: input.strictErrors,
  });
  const app = new Elysia();
  noStore(app);
  sessionGuard(app, input.api.access);
  originGuard(app, input.api.origin);
  legacyWorkspaceScopeGuard(app, input.api.access);
  legacySessionRoutes(route, app);
  registerScopedRoutes(route, app, input);
  return app;
}

// Одни и те же функции регистрируют маршруты обоих слоев: слой решает адрес и область.
function registerScopedRoutes(route: Route, app: Elysia, input: ApiInput) {
  if (input.documentHttp) documentRoutes(route, app, input.documentHttp);
  if (input.workHttp) {
    catalogRoutes(route, app, input.workHttp.works);
    worksRoutes(route, app, input.workHttp);
    connectionRoutes(route, app, input.workHttp);
  }
}
