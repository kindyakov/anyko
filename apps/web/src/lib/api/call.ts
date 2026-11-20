import type { z } from 'zod';

import {
  type Endpoint,
  idempotencyKeyHeaders,
  type JsonPart,
  type MultipartPart,
} from '@anyko/contracts/common';

import { requestApi, requestApiFile } from '@/lib/api/client';

// Версия входит в путь endpoint-описания; префикс `/api` добавляет транспорт (requestApi).
const versionPath = '/v1';

// callApi разбирает JSON. endpointUrl строит адрес для ссылок и событий.
type JsonEndpoint = Endpoint & { readonly response: JsonPart };
type FileEndpoint = Endpoint & {
  readonly method: 'GET';
  readonly response: { readonly kind: 'file' };
};

// Входы выводятся из схем описания: z.input для того, что вызывающий передаёт.
type ParamsField<E> = E extends { readonly params: infer P extends z.ZodType }
  ? { readonly params: z.input<P> }
  : { readonly params?: undefined };

type QueryField<E> = E extends { readonly query: infer Q extends z.ZodType }
  ? { readonly query?: z.input<Q> }
  : { readonly query?: undefined };

type BodyField<E> = E extends {
  readonly body: {
    readonly kind: 'json';
    readonly schema: infer S extends z.ZodType;
  };
}
  ? { readonly body: z.input<S> }
  : E extends {
        readonly body: {
          readonly kind: 'multipart';
          readonly fields: infer F extends z.ZodType;
        };
      }
    ? { readonly body: z.input<F> }
    : { readonly body?: undefined };

// Режим key требует ключ на уровне типов: повтор берёт тот же ключ, новое действие — новый.
type KeyField<E> = E extends { readonly idempotency: 'key' }
  ? { readonly idempotencyKey: string }
  : { readonly idempotencyKey?: undefined };

type CallOptions<E> = ParamsField<E> &
  QueryField<E> &
  BodyField<E> &
  KeyField<E> & {
    readonly signal?: AbortSignal;
    readonly timeoutMs?: number;
  };

// Без обязательных частей опции можно опустить: `callApi(getSession)`.
type CallArgs<E> = E extends
  | { readonly params: unknown }
  | { readonly body: unknown }
  | { readonly idempotency: 'key' }
  ? [options: CallOptions<E>]
  : [options?: CallOptions<E>];

type UrlOptions<E> = ParamsField<E> & QueryField<E>;

type UrlArgs<E> = E extends { readonly params: unknown }
  ? [options: UrlOptions<E>]
  : [options?: UrlOptions<E>];

// Общая форма опций для реализации: проверка значений выполняется здесь, в рантайме.
type LooseOptions = {
  readonly params?: unknown;
  readonly query?: unknown;
  readonly body?: unknown;
  readonly idempotencyKey?: string | undefined;
  readonly signal?: AbortSignal | undefined;
  readonly timeoutMs?: number | undefined;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Подставляет `:name` значениями params и кодирует их. Неподставленный параметр — ошибка вызова.
function fillPath(template: string, params: unknown): string {
  if (params !== undefined && !isRecord(params))
    throw new Error('Параметры пути задаются объектом');
  const values: Record<string, unknown> = isRecord(params) ? params : {};
  return template.replace(/:([A-Za-z_]\w*)/g, (_match, name: string) => {
    const value = values[name];
    if (typeof value !== 'string' && typeof value !== 'number')
      throw new Error(`Не задан параметр пути «${name}»`);
    return encodeURIComponent(String(value));
  });
}

// Пустые значения (undefined) пропускаются; пустая строка уходит как есть (`after=` — первая страница).
function queryPairs(query: unknown): Record<string, string> {
  if (query === undefined) return {};
  if (!isRecord(query)) throw new Error('Параметры запроса задаются объектом');
  const pairs: Record<string, string> = {};
  for (const [name, value] of Object.entries(query)) {
    if (value === undefined) continue;
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    )
      throw new Error(`Параметр запроса «${name}» должен быть скалярным`);
    pairs[name] = String(value);
  }
  return pairs;
}

function formData(value: unknown): FormData {
  if (!isRecord(value)) throw new Error('Тело формы задаётся объектом полей');
  const form = new FormData();
  for (const [name, field] of Object.entries(value)) {
    if (field === undefined) continue;
    if (typeof field === 'string') form.append(name, field);
    else if (field instanceof Blob) form.append(name, field);
    else throw new Error(`Поле формы «${name}» должно быть строкой или файлом`);
  }
  return form;
}

// Content-Type формы не задаётся: браузер добавит границу multipart сам.
function encodeBody(
  part: JsonPart | MultipartPart | undefined,
  value: unknown,
): { readonly body?: BodyInit; readonly contentType?: string } {
  if (part === undefined) {
    if (value !== undefined)
      throw new Error('Контракт не описывает тело запроса');
    return {};
  }
  if (value === undefined) throw new Error('Для запроса нужно тело');
  if (part.kind === 'json')
    return { body: JSON.stringify(value), contentType: 'application/json' };
  return { body: formData(value) };
}

// Режим key: ключ проверяет тот же заголовочный контракт, что и API; без него запрос не уходит.
function idempotencyHeaders(
  endpoint: JsonEndpoint,
  key: string | undefined,
): Record<string, string> {
  if (endpoint.idempotency !== 'key') return {};
  const parsed = idempotencyKeyHeaders.safeParse({ 'idempotency-key': key });
  if (!parsed.success)
    throw new Error(
      'Команда требует Idempotency-Key: создайте ключ через newIdempotencyKey() на одно действие',
    );
  return { 'idempotency-key': parsed.data['idempotency-key'] };
}

function performJson(
  endpoint: JsonEndpoint,
  options: LooseOptions,
): Promise<unknown> {
  const { body, contentType } = encodeBody(endpoint.body, options.body);
  const headers: Record<string, string> = idempotencyHeaders(
    endpoint,
    options.idempotencyKey,
  );
  if (contentType !== undefined) headers['content-type'] = contentType;
  // Схема описания проверяет ответ в requestApi; тип результата задаёт перегрузка callApi.
  return requestApi(
    `${versionPath}${fillPath(endpoint.path, options.params)}`,
    endpoint.response.schema,
    {
      method: endpoint.method,
      headers,
      query: queryPairs(options.query),
      ...(body === undefined ? {} : { body }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.timeoutMs === undefined
        ? {}
        : { timeoutMs: options.timeoutMs }),
    },
  );
}

// Вызов JSON-описания: путь, параметры, query, тело и ключ собираются по контракту, ответ проверяется
// его схемой. Ошибки и таймаут приходят из requestApi (ApiError).
export function callApi<E extends JsonEndpoint>(
  endpoint: E,
  ...args: CallArgs<E>
): Promise<z.output<E['response']['schema']>>;
export function callApi(
  endpoint: JsonEndpoint,
  ...args: [options?: LooseOptions]
): Promise<unknown> {
  const options: LooseOptions = args[0] ?? {};
  // Ошибки входа (параметры, тело, ключ) попадают в отказ промиса, а не в исключение при вызове.
  return Promise.resolve().then(() => performJson(endpoint, options));
}

export async function callFileApi<E extends FileEndpoint>(
  endpoint: E,
  ...args: CallArgs<E>
): Promise<Blob> {
  const options: LooseOptions = args[0] ?? {};
  return requestApiFile(
    `${versionPath}${fillPath(endpoint.path, options.params)}`,
    {
      query: queryPairs(options.query),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.timeoutMs === undefined
        ? {}
        : { timeoutMs: options.timeoutMs }),
    },
  );
}

// Адрес для ссылки на скачивание и EventSource: тот же путь, что у callApi, без вызова.
export function endpointUrl<E extends Endpoint>(
  endpoint: E,
  ...args: UrlArgs<E>
): string {
  const options: LooseOptions = args[0] ?? {};
  const query = new URLSearchParams(queryPairs(options.query)).toString();
  return `/api${versionPath}${fillPath(endpoint.path, options.params)}${query ? `?${query}` : ''}`;
}

// Ключ на одно намеренное действие (клик, отправка); повтор той же команды передаёт тот же ключ.
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
