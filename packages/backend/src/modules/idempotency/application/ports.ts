// Порты хранилища повтора. Реализация — infrastructure; сценарий знает только состояния захвата.

export interface IdempotencyKeyRef {
  readonly workspaceId: string;
  readonly command: string;
  readonly key: string;
}

export interface StoredResponse {
  readonly status: number;
  // JSON-объект, как его отдаёт маршрут; хранилище проверяет форму на границе записи.
  readonly body: unknown;
}

export interface AcquireInput extends IdempotencyKeyRef {
  readonly fingerprint: string;
  // Владелец захвата: завершить или снять захват может только тот, у кого этот токен.
  readonly token: string;
  readonly now: Date;
  readonly expiresAt: Date;
  readonly lockedUntil: Date;
}

export type AcquireOutcome =
  | { readonly kind: 'acquired' }
  | { readonly kind: 'replay'; readonly response: StoredResponse }
  | { readonly kind: 'conflict' }
  | { readonly kind: 'in_progress' };

export interface IdempotencyStore {
  // Захват атомарен: при гонке двух запросов один получает захват, второй — результат или отказ.
  acquire(input: AcquireInput): Promise<AcquireOutcome>;
  // Возвращает false, если захват уже перехвачен другим владельцем.
  complete(
    ref: IdempotencyKeyRef,
    token: string,
    response: StoredResponse,
    now: Date,
  ): Promise<boolean>;
  release(ref: IdempotencyKeyRef, token: string): Promise<void>;
}
