import { z } from 'zod';

import type { ErrorCode } from './errors';

// Описание HTTP-endpoint: одна запись на маршрут. API регистрирует по нему маршрут,
// проверяет вход и ответ, строит OpenAPI; web вызывает то же описание (ADR 0009).
// Путь без версии: `/api/v1` добавляет API, временный префикс без версии — тоже API.

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface JsonPart<S extends z.ZodType = z.ZodType> {
  readonly kind: 'json';
  readonly schema: S;
}
export interface MultipartPart<F extends z.ZodObject = z.ZodObject> {
  readonly kind: 'multipart';
  readonly fields: F;
}
export interface FileResponse {
  readonly kind: 'file';
}
export interface EventsResponse {
  readonly kind: 'events';
}

export const json = <S extends z.ZodType>(schema: S): JsonPart<S> => ({
  kind: 'json',
  schema,
});
// `shape` перечисляет поля формы; значение каждого поля проверяется его схемой (например, z.file()).
export const multipart = <S extends z.core.$ZodLooseShape>(
  shape: S,
): MultipartPart<z.ZodObject<S>> => ({
  kind: 'multipart',
  fields: z.object(shape),
});
export const fileDownload = (): FileResponse => ({ kind: 'file' });
export const eventStream = (): EventsResponse => ({ kind: 'events' });

export interface EndpointSpec {
  readonly method: HttpMethod;
  readonly path: `/${string}`;
  readonly params?: z.ZodObject;
  readonly query?: z.ZodObject;
  // Имена заголовков в нижнем регистре.
  readonly headers?: z.ZodObject;
  readonly body?: JsonPart | MultipartPart;
  readonly response: JsonPart | FileResponse | EventsResponse;
  readonly status: 200 | 201 | 202;
  // Коды доменных ошибок, которые может вернуть обработчик, плюс код входа (invalid).
  readonly errors: readonly ErrorCode[];
  // Код ошибки разбора params, query и body; заголовки используют invalidHeaders или invalid.
  readonly invalid?: ErrorCode;
  readonly invalidHeaders?: ErrorCode;
  // Задаётся обязательно для POST/PUT/PATCH/DELETE (см. IdempotencyField); у GET отсутствует.
  readonly idempotent?: boolean;
}

// Для POST/PUT/PATCH/DELETE решение об идемпотентности обязательно указать в описании;
// у GET поля нет. Это решение, а не механизм: хранилище ключей относится к отдельному этапу.
type IdempotencyField<M extends EndpointSpec['method']> = M extends 'GET'
  ? { readonly idempotent?: never }
  : { readonly idempotent: boolean };

const endpointTag = Symbol.for('anyko.endpoint');
export type Endpoint<S extends EndpointSpec = EndpointSpec> = S & {
  readonly [endpointTag]: true;
};

export function endpoint<const S extends EndpointSpec>(
  spec: S & IdempotencyField<S['method']>,
): Endpoint<S> {
  const hasInput =
    spec.params !== undefined ||
    spec.query !== undefined ||
    spec.headers !== undefined ||
    spec.body !== undefined;
  if (hasInput && spec.invalid === undefined)
    throw new Error(
      `${spec.method} ${spec.path}: укажите invalid для ошибок входа`,
    );
  const codes: readonly ErrorCode[] = spec.errors;
  for (const code of [spec.invalid, spec.invalidHeaders])
    if (code !== undefined && !codes.includes(code))
      throw new Error(`${spec.method} ${spec.path}: код ${code} не в errors`);
  return Object.assign(spec, { [endpointTag]: true as const });
}

export function isEndpoint(value: unknown): value is Endpoint {
  return typeof value === 'object' && value !== null && endpointTag in value;
}
