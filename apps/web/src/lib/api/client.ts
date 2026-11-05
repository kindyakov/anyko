import { httpErrorSchema } from '@anyko/contracts';
import type { z } from 'zod';

export type HttpFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number | undefined,
    readonly requestId: string | undefined,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}
export async function requestApi<T>(
  path: string,
  schema: z.ZodType<T>,
  options: {
    method?: 'GET' | 'POST' | 'DELETE';
    body?: BodyInit;
    headers?: HeadersInit;
    signal?: AbortSignal;
    timeoutMs?: number;
    fetch?: HttpFetch;
  } = {},
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
    headers.set('accept', 'application/json');
    const response = await (options.fetch ?? fetch)(`/api${path}`, {
      method: options.method ?? 'GET',
      ...(options.body === undefined ? {} : { body: options.body }),
      headers,
      signal: controller.signal,
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
    });
    status = response.status;
    requestId = response.headers.get('x-request-id') ?? undefined;
    const body: unknown = await response.json();
    if (!response.ok) {
      const parsed = httpErrorSchema.safeParse(body);
      throw new ApiError(
        parsed.success ? parsed.data.error.code : 'HTTP_ERROR',
        status,
        requestId,
      );
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      throw new ApiError('INVALID_RESPONSE', status, requestId);
    return parsed.data;
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
