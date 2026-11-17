import type { Elysia } from 'elysia';
import type { z } from 'zod';

import { AppError, isAppError } from '@anyko/backend/errors';
import {
  fingerprintInput,
  type IdempotencyApi,
} from '@anyko/backend/idempotency';
import type { WorkspaceScope } from '@anyko/backend/scope';
import {
  type Endpoint,
  type ErrorCode,
  type FileResponse,
  type JsonPart,
  type MultipartPart,
  optionalIdempotencyKeyHeaders,
} from '@anyko/contracts/common';
import type { Session } from '@anyko/contracts/session';
import type { Logger } from '@anyko/logger';

import { requestState } from './request-state';

// route() регистрирует маршрут по endpoint-описанию из contracts (ADR 0009): разбирает вход,
// проверяет ответ и выставляет статус успеха. Сценарий получает уже проверенные значения и
// доверенную область, если адрес её содержит. Порядок: сессия → origin → область → вход → сценарий.

// Слой адресов: версия API или временный префикс без версии (его удалит web #11).
export interface RouteLayer {
  readonly prefix: string;
  // Путь маршрута внутри слоя или null: слой не регистрирует это описание.
  pathOf(endpoint: Endpoint): string | null;
  // Ключ Idempotency-Key у режима key можно не передавать. Только временный слой; v1 требует ключ всегда.
  keyOptional(endpoint: Endpoint): boolean;
}

export const versionedLayer: RouteLayer = {
  prefix: '/api/v1',
  pathOf: (endpoint) => endpoint.path,
  keyOptional: () => false,
};

export interface RouteEnv {
  readonly layer: RouteLayer;
  readonly logger: Logger;
  // В тестах код ошибки, не объявленный в описании, даёт 500: тест ловит расхождение.
  readonly strictErrors: boolean;
  // Описания версии v1, из них строится OpenAPI; временный слой не добавляет туда ничего.
  readonly endpoints?: Set<Endpoint>;
  // Хранилище повтора команд (модуль idempotency): маршруты режима key выполняются через него.
  readonly idempotency: IdempotencyApi;
}

interface FileResult {
  readonly bytes: Uint8Array;
  // Заголовки, которые задаёт сценарий (тип, имя, политика показа). no-store и nosniff добавляет route.
  readonly headers: Readonly<Record<string, string>>;
}

type ParsedPart<E, K extends string> =
  E extends Record<K, infer S>
    ? S extends z.ZodType
      ? z.output<S>
      : never
    : undefined;
type BodyOf<E> = E extends { body: JsonPart<infer S> }
  ? z.output<S>
  : E extends { body: MultipartPart<infer F> }
    ? z.output<F>
    : undefined;
type ResponseOf<E> = E extends { response: JsonPart<infer S> }
  ? z.output<S>
  : E extends { response: FileResponse }
    ? FileResult
    : Response;

// Маршрут с :workspaceId получает область, которую уже проверил plugin; остальным она не передаётся.
type ScopeOf<E> = E extends { path: `${string}:workspaceId${string}` }
  ? { readonly scope: WorkspaceScope }
  : { readonly scope?: WorkspaceScope };

type RouteContext<E extends Endpoint> = ScopeOf<E> & {
  readonly session: Session;
  readonly requestId: string;
  readonly request: Request;
  readonly signal: AbortSignal;
  readonly params: ParsedPart<E, 'params'>;
  readonly query: ParsedPart<E, 'query'>;
  readonly headers: ParsedPart<E, 'headers'>;
  readonly body: BodyOf<E>;
  // Адрес другого описания в этом слое: ссылки в ответе строятся тем же префиксом, что и вызов.
  readonly link: (target: Endpoint, params: Record<string, string>) => string;
};

type RouteHandler<E extends Endpoint> = (
  context: RouteContext<E>,
) => ResponseOf<E> | Promise<ResponseOf<E>>;

export type Route = <E extends Endpoint>(
  app: Elysia,
  endpoint: E,
  handler: RouteHandler<E>,
) => Elysia;

export function createRoute(env: RouteEnv): Route {
  const { layer } = env;
  const link = (target: Endpoint, params: Record<string, string>) => {
    const path = layer.pathOf(target);
    if (path === null) throw new Error('LINK_TARGET_NOT_IN_LAYER');
    const filled = path.replaceAll(/:(\w+)/g, (_match, name: string) => {
      const value = params[name];
      if (value === undefined) throw new Error(`LINK_PARAM_MISSING:${name}`);
      return encodeURIComponent(value);
    });
    return `${layer.prefix}${filled}`;
  };
  return function route(app, endpoint, handler) {
    const path = layer.pathOf(endpoint);
    if (path === null) return app;
    env.endpoints?.add(endpoint);
    app.route(
      endpoint.method,
      `${layer.prefix}${path}`,
      async ({ request, params, query, set }) => {
        const state = requestState(request);
        const session = state?.session;
        if (!state || !session) throw new Error('SESSION_NOT_RESOLVED');
        const requestId = state.requestId;
        const allowed = new Set<string>(endpoint.errors);
        try {
          // Во временном слое области нет в адресе: её идентификатор берётся из scope. В v1 он совпадает с адресом.
          const pathParams = state.scope
            ? { ...params, workspaceId: state.scope.workspaceId }
            : params;
          // Временный слой может не требовать ключ у части команд; заголовок без ключа тогда допустим.
          const headers =
            endpoint.idempotency === 'key' && env.layer.keyOptional(endpoint)
              ? optionalIdempotencyKeyHeaders
              : endpoint.headers;
          const input = await readInput(
            endpoint,
            request,
            pathParams,
            query,
            headers,
          );
          const context = {
            ...input,
            session,
            scope: state.scope,
            requestId,
            request,
            signal: request.signal,
            link,
          } as RouteContext<typeof endpoint>;
          const key =
            endpoint.idempotency === 'key'
              ? idempotencyKeyOf(input.headers)
              : undefined;
          // Без ключа команда выполняется как прежде: так работает только временный слой (ADR 0009).
          if (key === undefined || endpoint.idempotency !== 'key') {
            const value = await handler(context);
            return await respond(endpoint, value, set, env.logger, requestId);
          }
          if (!state.scope) throw new Error('KEYED_ROUTE_WITHOUT_SCOPE');
          // Повтор с тем же ключом, областью, командой и входом отдаёт сохранённый ответ, сценарий
          // не запускается. Отпечаток — от разобранного входа, поэтому порядок полей не важен.
          const stored = await env.idempotency.run(
            {
              workspaceId: state.scope.workspaceId,
              command: `${endpoint.method} ${endpoint.path}`,
              key,
              fingerprint: await fingerprintInput({
                params: input.params,
                query: input.query,
                body: input.body,
              }),
            },
            async () => {
              const value = await handler(context);
              return {
                status: endpoint.status,
                body: await checkedJson(endpoint, value, env.logger, requestId),
              };
            },
          );
          set.status = stored.status;
          return stored.body;
        } catch (error) {
          if (isAppError(error) && !allowed.has(error.code)) {
            env.logger.error({
              event: 'http_undeclared_error_code',
              requestId,
              errorCode: error.code,
              route: endpoint.path,
            });
            if (env.strictErrors)
              throw new Error('UNDECLARED_ERROR_CODE', { cause: error });
          }
          throw error;
        }
      },
      { parse: 'none' },
    );
    return app;
  };
}

// Код ошибки входа берётся из описания; endpoint() требует invalid при любом входе,
// поэтому запасной INVALID_REQUEST сработал бы только при обходе описания.
function inputCode(endpoint: Endpoint, headers = false): ErrorCode {
  return (
    (headers ? endpoint.invalidHeaders : undefined) ??
    endpoint.invalid ??
    'INVALID_REQUEST'
  );
}

async function readInput(
  endpoint: Endpoint,
  request: Request,
  params: Record<string, string | undefined>,
  query: Record<string, string | undefined>,
  headers: z.ZodObject | undefined,
) {
  const input: {
    headers?: unknown;
    params?: unknown;
    query?: unknown;
    body?: unknown;
  } = {};
  if (headers)
    input.headers = await parseWith(
      headers,
      Object.fromEntries(request.headers),
      inputCode(endpoint, true),
    );
  if (endpoint.params)
    input.params = await parseWith(
      endpoint.params,
      params,
      inputCode(endpoint),
    );
  if (endpoint.query)
    input.query = await parseWith(endpoint.query, query, inputCode(endpoint));
  const body = endpoint.body;
  if (body?.kind === 'json')
    input.body = await parseWith(
      body.schema,
      await readJson(request, inputCode(endpoint)),
      inputCode(endpoint),
    );
  if (body?.kind === 'multipart') {
    const form = await readForm(request, inputCode(endpoint));
    const fields = Object.fromEntries(
      Object.keys(body.fields.shape).map((name) => [name, form.get(name)]),
    );
    input.body = await parseWith(body.fields, fields, inputCode(endpoint));
  }
  return input;
}

// Проверка через Standard Schema: та же проверка, что у Elysia, но код ошибки берётся из описания.
async function parseWith<S extends z.ZodType>(
  schema: S,
  value: unknown,
  code: ErrorCode,
): Promise<z.output<S>> {
  const result = await schema['~standard'].validate(value);
  if (result.issues !== undefined) throw new AppError(code, 'invalid');
  return result.value;
}

async function readJson(request: Request, code: ErrorCode): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError(code, 'invalid');
  }
}

async function readForm(request: Request, code: ErrorCode): Promise<FormData> {
  try {
    return await request.formData();
  } catch {
    throw new AppError(code, 'invalid');
  }
}

async function respond(
  endpoint: Endpoint,
  value: unknown,
  set: { status?: number | string; headers: Record<string, unknown> },
  logger: Logger,
  requestId: string,
): Promise<unknown> {
  const response = endpoint.response;
  if (response.kind === 'events') {
    if (!(value instanceof Response))
      throw new Error('EVENTS_RESPONSE_EXPECTED');
    return value;
  }
  if (response.kind === 'file') {
    if (!isFileResult(value)) throw new Error('FILE_RESPONSE_EXPECTED');
    return new Response(Uint8Array.from(value.bytes), {
      status: endpoint.status,
      headers: {
        ...value.headers,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  }
  await checkedJson(endpoint, value, logger, requestId);
  set.status = endpoint.status;
  return value;
}

// Ответ json проверяется схемой описания до отправки; нарушение — внутренняя ошибка.
async function checkedJson(
  endpoint: Endpoint,
  value: unknown,
  logger: Logger,
  requestId: string,
): Promise<unknown> {
  if (endpoint.response.kind !== 'json')
    throw new Error('JSON_RESPONSE_EXPECTED');
  const check = await endpoint.response.schema['~standard'].validate(value);
  if (check.issues !== undefined) {
    logger.error({
      event: 'http_response_invalid',
      requestId,
      route: endpoint.path,
    });
    throw new Error('RESPONSE_CONTRACT_VIOLATION');
  }
  return value;
}

// Заголовок Idempotency-Key уже проверен схемой; здесь только выбор значения.
function idempotencyKeyOf(headers: unknown): string | undefined {
  if (typeof headers !== 'object' || headers === null) return undefined;
  const value: unknown = Reflect.get(headers, 'idempotency-key');
  return typeof value === 'string' ? value : undefined;
}

function isFileResult(value: unknown): value is FileResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'bytes' in value &&
    value.bytes instanceof Uint8Array &&
    'headers' in value
  );
}
