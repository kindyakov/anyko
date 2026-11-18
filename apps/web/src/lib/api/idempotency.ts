import { useState } from 'react';

import { newIdempotencyKey } from '@/lib/api/call';
import { ApiError } from '@/lib/api/errors';

// Ключ одного намеренного действия (кнопка, отправка формы). Повтор того же действия после
// неизвестного исхода передаёт тот же ключ; успех или определённый ответ сервера начинают новое действие.
export type IdempotencyKey = {
  take(): string;
  settle(error?: unknown): void;
};

// Эти ответы не подтверждают завершение команды.
const unsettledOutcomeCodes = new Set([
  'NETWORK_ERROR',
  'REQUEST_TIMEOUT',
  'REQUEST_ABORTED',
  'HTTP_ERROR',
  'INVALID_RESPONSE',
  'IDEMPOTENCY_IN_PROGRESS',
]);

export function createIdempotencyKey(): IdempotencyKey {
  let current: string | undefined;
  return {
    take() {
      current ??= newIdempotencyKey();
      return current;
    },
    settle(error?: unknown) {
      if (isUnsettledOutcome(error)) return;
      current = undefined;
    },
  };
}

// Ключ действия для компонента: один объект на жизнь экрана или формы.
export function useIdempotencyKey(): IdempotencyKey {
  const [key] = useState(createIdempotencyKey);
  return key;
}

export async function withIdempotencyKey<T>(
  key: IdempotencyKey,
  send: (idempotencyKey: string) => Promise<T>,
): Promise<T> {
  try {
    const result = await send(key.take());
    key.settle();
    return result;
  } catch (error) {
    key.settle(error);
    throw error;
  }
}

function isUnsettledOutcome(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return error.status === undefined || unsettledOutcomeCodes.has(error.code);
}
