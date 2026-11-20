import {
  createIdempotency,
  type IdempotencyApi,
  type IdempotencyStore,
  type StoredOutcome,
} from '@anyko/backend/idempotency';
import { createLogger } from '@anyko/logger';

interface Row {
  readonly fingerprint: string;
  token: string;
  outcome?: StoredOutcome;
  expiresAt: Date;
  lockedUntil: Date;
}

// Память вместо PostgreSQL для проверок маршрута: HTTP-поведение повтора. Хранилище PostgreSQL
// проверяет integration-тест модуля idempotency.
export function memoryIdempotency(): IdempotencyApi {
  const rows = new Map<string, Row>();
  const store: IdempotencyStore = {
    acquire(input) {
      const id = `${input.workspaceId}\n${input.command}\n${input.key}`;
      const row = rows.get(id);
      const claim = {
        fingerprint: input.fingerprint,
        token: input.token,
        expiresAt: input.expiresAt,
        lockedUntil: input.lockedUntil,
      };
      if (!row || row.expiresAt <= input.now) {
        rows.set(id, claim);
        return Promise.resolve({ kind: 'acquired' });
      }
      if (row.fingerprint !== input.fingerprint)
        return Promise.resolve({ kind: 'conflict' });
      if (row.outcome)
        return Promise.resolve({
          kind: 'replay',
          outcome: row.outcome,
        });
      if (row.lockedUntil > input.now)
        return Promise.resolve({ kind: 'in_progress' });
      rows.set(id, {
        ...row,
        token: input.token,
        lockedUntil: input.lockedUntil,
      });
      return Promise.resolve({ kind: 'acquired' });
    },
    complete(ref, token, outcome, _resource, now) {
      const id = `${ref.workspaceId}\n${ref.command}\n${ref.key}`;
      const row = rows.get(id);
      if (!row || row.token !== token || row.outcome)
        return Promise.resolve(false);
      rows.set(id, {
        ...row,
        outcome,
        lockedUntil: now,
      });
      return Promise.resolve(true);
    },
    release(ref, token) {
      const id = `${ref.workspaceId}\n${ref.command}\n${ref.key}`;
      const row = rows.get(id);
      if (row?.token === token && !row.outcome) rows.delete(id);
      return Promise.resolve();
    },
  };
  return createIdempotency({
    store,
    clock: { now: () => new Date() },
    newToken: () => crypto.randomUUID(),
    logger: createLogger({
      service: 'api',
      environment: 'test',
      release: 'memory-idempotency',
      level: 'fatal',
    }),
  });
}
