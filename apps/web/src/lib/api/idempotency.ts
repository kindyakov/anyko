import { useState } from 'react';

import { newIdempotencyKey } from '@/lib/api/call';
import { ApiError } from '@/lib/api/errors';

// Ключ одного намеренного действия (кнопка, отправка формы). Повтор того же действия после
// неизвестного исхода передаёт тот же ключ; успех или определённый ответ сервера начинают новое действие.
export type IdempotencyKey = {
  take(): string;
  settle(error?: unknown): void;
};

// Коды, при которых запрос мог дойти до сервера, а ответа мы не получили.
const unknownOutcomeCodes = new Set([
  'NETWORK_ERROR',
  'REQUEST_TIMEOUT',
  'REQUEST_ABORTED',
]);

export function createIdempotencyKey(): IdempotencyKey {
  let current: string | undefined;
  return {
    take() {
      current ??= newIdempotencyKey();
      return current;
    },
    settle(error?: unknown) {
      // Ответ сервера с кодом статуса определяет исход, включая отказ повтора (IDEMPOTENCY_CONFLICT).
      // Без статуса или при сетевом обрыве исход неизвестен: ключ сохраняется для повтора.
      if (isUnknownOutcome(error)) return;
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

function isUnknownOutcome(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return error.status === undefined || unknownOutcomeCodes.has(error.code);
}
