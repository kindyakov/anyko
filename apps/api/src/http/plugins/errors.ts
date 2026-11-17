import type { Elysia } from 'elysia';

import { type ErrorKind, isAppError } from '@anyko/backend/errors';
import type { Logger } from '@anyko/logger';

import { transportErrorCodes } from '../errors';
import { requestState } from '../request-state';

const statusByKind = {
  invalid: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  precondition: 409,
  unavailable: 503,
} satisfies Record<ErrorKind, number>;

// Единственное место, где ошибка становится HTTP-ответом: вид AppError задаёт статус.
export function errorHandling(app: Elysia, logger: Logger): void {
  app.onError(({ code, error, set, request }) => {
    const id = requestState(request)?.requestId ?? crypto.randomUUID();
    set.headers['x-request-id'] = id;
    if (isAppError(error)) {
      set.status = statusByKind[error.kind];
      return {
        error: {
          code: error.code,
          requestId: id,
          ...(error.fields ? { fields: error.fields } : {}),
        },
      };
    }
    const status =
      code === 'NOT_FOUND'
        ? 404
        : code === 'VALIDATION' || code === 'PARSE'
          ? 400
          : 500;
    set.status = status;
    const errorCode =
      status === 404
        ? transportErrorCodes.NOT_FOUND
        : status === 400
          ? transportErrorCodes.INVALID_REQUEST
          : transportErrorCodes.INTERNAL_ERROR;
    if (status === 500)
      logger.error({ event: 'http_failed', requestId: id, errorCode });
    return { error: { code: errorCode, requestId: id } };
  });
}
