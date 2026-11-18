// Порты хранилища повтора. Реализация — infrastructure; сценарий знает только состояния захвата.

export interface IdempotencyKeyRef {
  readonly workspaceId: string;
  readonly command: string;
  readonly key: string;
}

interface StoredResponse {
  readonly status: number;
  readonly body: string;
}

export interface CreatedResource {
  readonly kind: 'work' | 'document';
  readonly id: string;
}

export interface CommandResponse {
  readonly response: StoredResponse;
  readonly resource?: CreatedResource;
}

export type StoredOutcome =
  | { readonly kind: 'response'; readonly response: StoredResponse }
  | { readonly kind: 'resource_unavailable' };

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
  | { readonly kind: 'replay'; readonly outcome: StoredOutcome }
  | { readonly kind: 'conflict' }
  | { readonly kind: 'in_progress' };

export interface IdempotencyStore {
  // Захват атомарен: при гонке двух запросов один получает захват, второй — результат или отказ.
  acquire(input: AcquireInput): Promise<AcquireOutcome>;
  // Возвращает false, если захват уже перехвачен другим владельцем.
  complete(
    ref: IdempotencyKeyRef,
    token: string,
    outcome: StoredOutcome,
    resource: CreatedResource | undefined,
    now: Date,
  ): Promise<boolean>;
  release(ref: IdempotencyKeyRef, token: string): Promise<void>;
}
