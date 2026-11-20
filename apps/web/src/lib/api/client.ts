import type { z } from 'zod';

import { httpErrorSchema, type HttpMethod } from '@anyko/contracts/common';

import { ApiError } from '@/lib/api/errors';

export type HttpFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type RequestOptions = {
  method?: HttpMethod;
  body?: BodyInit;
  headers?: HeadersInit;
  signal?: AbortSignal;
  timeoutMs?: number;
  query?: Record<string, string>;
  fetch?: HttpFetch;
};

// Путь без `/api`: префикс добавляет транспорт, версия (`/v1`) входит в путь вызывающего.
async function request<T>(
  path: string,
  options: RequestOptions,
  accept: string,
  read: (response: Response, requestId: string | undefined) => Promise<T>,
): Promise<T> {
  if (
    !/^\/[a-zA-Z0-9/_-]*$/.test(path) ||
    path.includes('//') ||
    path.split('/').includes('..')
  )
    throw new ApiError('INVALID_API_PATH', undefined, undefined);
  const timeout = options.timeoutMs ?? 30000;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 60000)
    throw new ApiError('INVALID_TIMEOUT', undefined, undefined);
  const controller = new AbortController();
  const state = { timedOut: false };
  const abort = () => {
    controller.abort();
  };
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => {
    state.timedOut = true;
    controller.abort();
  }, timeout);
  let status: number | undefined;
  let requestId: string | undefined;
  try {
    const headers = new Headers(options.headers);
    headers.set('accept', accept);
    const query = new URLSearchParams(options.query).toString();
    const response = await (options.fetch ?? fetch)(
      `/api${path}${query ? `?${query}` : ''}`,
      {
        method: options.method ?? 'GET',
        ...(options.body === undefined ? {} : { body: options.body }),
        headers,
        signal: controller.signal,
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
      },
    );
    status = response.status;
    requestId = response.headers.get('x-request-id') ?? undefined;
    if (!response.ok) {
      const body: unknown = await response.json();
      const parsed = httpErrorSchema.safeParse(body);
      throw new ApiError(
        parsed.success ? parsed.data.error.code : 'HTTP_ERROR',
        status,
        requestId,
        parsed.success ? parsed.data.error.fields : undefined,
      );
    }
    return await read(response, requestId);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      state.timedOut
        ? 'REQUEST_TIMEOUT'
        : options.signal?.aborted
          ? 'REQUEST_ABORTED'
          : status === undefined
            ? 'NETWORK_ERROR'
            : 'INVALID_RESPONSE',
      status,
      requestId,
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}

export function requestApi<S extends z.ZodType>(
  path: string,
  schema: S,
  options: RequestOptions = {},
): Promise<z.output<S>> {
  return request(
    path,
    options,
    'application/json',
    async (response, requestId) => {
      const body: unknown = await response.json();
      const parsed = schema.safeParse(body);
      if (!parsed.success)
        throw new ApiError('INVALID_RESPONSE', response.status, requestId);
      return parsed.data;
    },
  );
}

export function requestApiFile(path: string, options: RequestOptions) {
  return request(path, options, '*/*', (response) => response.blob());
}
