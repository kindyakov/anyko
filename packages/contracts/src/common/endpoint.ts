import { z } from 'zod';

import type { ErrorCode } from './errors';
import { idempotencyKeyHeaders } from './idempotency';

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

// Режим повтора команды (ADR 0009). Обязателен у POST/PUT/PATCH/DELETE, у GET отсутствует.
//  - key: повтор с тем же Idempotency-Key возвращает сохранённый ответ; заголовок и его коды
//    добавляет и проверяет контракт, хранилище ведёт модуль idempotency.
//  - natural: повтор безопасен по смыслу (удаление, правка с ревизией, подтверждение, сохранение
//    настроек); отдельного ключа нет.
//  - none: повтор не безопасен или не проверен; ключа нет.
export type Idempotency = 'key' | 'natural' | 'none';

export interface EndpointSpec {
  readonly method: HttpMethod;
  readonly path: `/${string}`;
  readonly params?: z.ZodObject;
  readonly query?: z.ZodObject;
  // Имена заголовков в нижнем регистре. Для режима key заголовок Idempotency-Key задаёт endpoint().
  readonly headers?: z.ZodObject;
  readonly body?: JsonPart | MultipartPart;
  readonly response: JsonPart | FileResponse | EventsResponse;
  readonly status: 200 | 201 | 202;
  // Коды доменных ошибок, которые может вернуть обработчик, плюс код входа (invalid).
  readonly errors: readonly ErrorCode[];
  // Код ошибки разбора params, query и body; заголовки используют invalidHeaders или invalid.
  readonly invalid?: ErrorCode;
  readonly invalidHeaders?: ErrorCode;
  readonly idempotency?: Idempotency;
}

// Для POST/PUT/PATCH/DELETE режим обязан быть указан в описании; у GET поля нет.
type IdempotencyField<M extends EndpointSpec['method']> = M extends 'GET'
  ? { readonly idempotency?: never }
  : { readonly idempotency: Idempotency };

// Для режима key описание получает заголовок и код его ошибки от контракта, а не из маршрута.
type KeyInput<S> = S extends { readonly idempotency: 'key' }
  ? {
      readonly headers: typeof idempotencyKeyHeaders;
      readonly invalidHeaders: 'INVALID_IDEMPOTENCY_KEY';
    }
  : unknown;

// Коды, которые режим key обязан объявить: без них маршрут не сможет вернуть отказ повтора.
const keyErrors = [
  'INVALID_IDEMPOTENCY_KEY',
  'IDEMPOTENCY_CONFLICT',
  'IDEMPOTENCY_IN_PROGRESS',
] as const;

const endpointTag = Symbol.for('anyko.endpoint');
export type Endpoint<S extends EndpointSpec = EndpointSpec> = S & {
  readonly [endpointTag]: true;
};

export function endpoint<const S extends EndpointSpec>(
  spec: S & IdempotencyField<S['method']>,
): Endpoint<S & KeyInput<S>> {
  const label = `${spec.method} ${spec.path}`;
  const hasInput =
    spec.params !== undefined ||
    spec.query !== undefined ||
    spec.headers !== undefined ||
    spec.body !== undefined;
  if (hasInput && spec.invalid === undefined)
    throw new Error(`${label}: укажите invalid для ошибок входа`);
  const codes: readonly ErrorCode[] = spec.errors;
  for (const code of [spec.invalid, spec.invalidHeaders])
    if (code !== undefined && !codes.includes(code))
      throw new Error(`${label}: код ${code} не в errors`);
  if (spec.idempotency === 'key') {
    if (spec.method === 'GET')
      throw new Error(`${label}: режим key допустим только для изменений`);
    if (spec.response.kind !== 'json')
      throw new Error(`${label}: режим key требует ответ json`);
    if (spec.headers !== undefined)
      throw new Error(
        `${label}: заголовок Idempotency-Key задаёт контракт, не описание`,
      );
    if (
      spec.invalidHeaders !== undefined &&
      spec.invalidHeaders !== 'INVALID_IDEMPOTENCY_KEY'
    )
      throw new Error(`${label}: invalidHeaders для режима key фиксирован`);
    for (const code of keyErrors)
      if (!codes.includes(code))
        throw new Error(`${label}: режим key требует код ${code} в errors`);
  }
  // Для режима key контракт сам добавляет заголовок; тип результата выводит KeyInput.
  const described: EndpointSpec =
    spec.idempotency === 'key'
      ? {
          ...spec,
          headers: idempotencyKeyHeaders,
          invalidHeaders: 'INVALID_IDEMPOTENCY_KEY',
        }
      : spec;
  return Object.assign(described, { [endpointTag]: true as const }) as Endpoint<
    S & KeyInput<S>
  >;
}

export function isEndpoint(value: unknown): value is Endpoint {
  return typeof value === 'object' && value !== null && endpointTag in value;
}
