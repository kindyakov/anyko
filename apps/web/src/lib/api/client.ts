import { httpErrorSchema } from '@anyko/contracts';
import type { z } from 'zod';

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

/** Validates unknown HTTP data and never exposes raw upstream bodies in errors. */
export async function requestApi<T>(
  path: string,
  schema: z.ZodType<T>,
  options: { baseUrl?: string; signal?: AbortSignal; timeoutMs?: number; fetch?: typeof fetch } = {},
): Promise<T> {
  if (!/^\/[\w/-]*$/.test(path) || path.includes('//') || path.split('/').includes('..')) {
    throw new ApiError('INVALID_API_PATH', undefined, undefined);
  }
  const timeoutMs = options.timeoutMs ?? 10000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) {
    throw new ApiError('INVALID_TIMEOUT', undefined, undefined);
  }
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  let status: number | undefined;
  let requestId: string | undefined;
  try {
    const response = await (options.fetch ?? fetch)(`${options.baseUrl ?? '/api'}${path}`, {
      signal: controller.signal, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      headers: { accept: 'application/json' },
    });
    status = response.status;
    requestId = response.headers.get('x-request-id') ?? undefined;
    const body: unknown = await response.json();
    if (!response.ok) {
      const parsed = httpErrorSchema.safeParse(body);
      throw new ApiError(parsed.success ? parsed.data.error.code : 'HTTP_ERROR', status, requestId);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new ApiError('INVALID_RESPONSE', status, requestId);
    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (timedOut) throw new ApiError('REQUEST_TIMEOUT', status, requestId);
    if (options.signal?.aborted) throw new ApiError('REQUEST_ABORTED', status, requestId);
    throw new ApiError(status === undefined ? 'NETWORK_ERROR' : 'INVALID_RESPONSE', status, requestId);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}
