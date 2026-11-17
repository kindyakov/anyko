import type { Elysia } from 'elysia';
import type { z } from 'zod';

import { AppError, isAppError } from '@anyko/backend/errors';
import type {
  Endpoint,
  ErrorCode,
  FileResponse,
  JsonPart,
  MultipartPart,
} from '@anyko/contracts/common';
import type { Session } from '@anyko/contracts/session';
import type { Logger } from '@anyko/logger';

import { requestState } from './request-state';

// route() регистрирует маршрут по endpoint-описанию из contracts (ADR 0009): разбирает вход,
// проверяет ответ и выставляет статус успеха. Сценарий получает уже проверенные значения.

export interface RouteEnv {
  // Описания, зарегистрированные маршрутами; из них строится OpenAPI.
  readonly endpoints: Set<Endpoint>;
  // Префикс версии или временный префикс без версии: в описании путь без него.
  readonly prefix: string;
  readonly logger: Logger;
  // В тестах код ошибки, не объявленный в описании, даёт 500: тест ловит расхождение.
  readonly strictErrors: boolean;
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

interface RouteContext<E extends Endpoint> {
  readonly session: Session;
  readonly requestId: string;
  readonly request: Request;
  readonly signal: AbortSignal;
  readonly params: ParsedPart<E, 'params'>;
  readonly query: ParsedPart<E, 'query'>;
  readonly headers: ParsedPart<E, 'headers'>;
  readonly body: BodyOf<E>;
}

type RouteHandler<E extends Endpoint> = (
  context: RouteContext<E>,
) => ResponseOf<E> | Promise<ResponseOf<E>>;

// Проверка доступа до разбора входа (как прежние маршруты: сначала право, потом тело).
interface RouteOptions {
  readonly guard?: (context: {
    session: Session;
    requestId: string;
  }) => Promise<void> | void;
}

export type Route = <E extends Endpoint>(
  app: Elysia,
  endpoint: E,
  handler: RouteHandler<E>,
  options?: RouteOptions,
) => Elysia;

export function createRoute(env: RouteEnv): Route {
  return function route(app, endpoint, handler, options) {
    env.endpoints.add(endpoint);
    app.route(
      endpoint.method,
      `${env.prefix}${endpoint.path}`,
      async ({ request, params, query, set }) => {
        const state = requestState(request);
        const session = state?.session;
        if (!state || !session) throw new Error('SESSION_NOT_RESOLVED');
        const requestId = state.requestId;
        const allowed = new Set<string>(endpoint.errors);
        try {
          await options?.guard?.({ session, requestId });
          const input = await readInput(endpoint, request, params, query);
          const value = await handler({
            ...input,
            session,
            requestId,
            request,
            signal: request.signal,
          } as RouteContext<typeof endpoint>);
          return await respond(endpoint, value, set, env.logger, requestId);
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
) {
  const input: {
    headers?: unknown;
    params?: unknown;
    query?: unknown;
    body?: unknown;
  } = {};
  if (endpoint.headers)
    input.headers = await parseWith(
      endpoint.headers,
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
  const check = await response.schema['~standard'].validate(value);
  if (check.issues !== undefined) {
    logger.error({
      event: 'http_response_invalid',
      requestId,
      route: endpoint.path,
    });
    throw new Error('RESPONSE_CONTRACT_VIOLATION');
  }
  set.status = endpoint.status;
  return value;
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
