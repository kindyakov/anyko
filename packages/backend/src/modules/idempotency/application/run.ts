import type { Logger } from '@anyko/logger';

import type { Clock } from '../../../platform/clock';
import {
  afterMs,
  CAPTURE_LEASE_MS,
  RESULT_RETENTION_MS,
} from '../domain/policy';
import { IdempotencyFailure } from '../errors';

import type {
  IdempotencyKeyRef,
  IdempotencyStore,
  StoredResponse,
} from './ports';

export interface IdempotentCommand extends IdempotencyKeyRef {
  readonly fingerprint: string;
}

export interface IdempotencyDeps {
  readonly store: IdempotencyStore;
  readonly clock: Clock;
  readonly newToken: () => string;
  readonly logger: Logger;
}

export interface IdempotentResult extends StoredResponse {
  readonly replayed: boolean;
}

// Захват → выполнение → сохранение ответа. Повтор с тем же входом получает сохранённый ответ и
// сценарий не запускается. Ошибка выполнения снимает захват: повтор с тем же ключом выполнится заново.
export async function runIdempotent(
  deps: IdempotencyDeps,
  command: IdempotentCommand,
  execute: () => Promise<StoredResponse>,
): Promise<IdempotentResult> {
  const ref: IdempotencyKeyRef = {
    workspaceId: command.workspaceId,
    command: command.command,
    key: command.key,
  };
  const token = deps.newToken();
  const now = deps.clock.now();
  const outcome = await deps.store.acquire({
    ...ref,
    fingerprint: command.fingerprint,
    token,
    now,
    expiresAt: afterMs(now, RESULT_RETENTION_MS),
    lockedUntil: afterMs(now, CAPTURE_LEASE_MS),
  });
  switch (outcome.kind) {
    case 'replay':
      return { ...outcome.response, replayed: true };
    case 'conflict':
      throw new IdempotencyFailure('IDEMPOTENCY_CONFLICT');
    case 'in_progress':
      throw new IdempotencyFailure('IDEMPOTENCY_IN_PROGRESS');
    case 'acquired':
      break;
  }
  let response: StoredResponse;
  try {
    response = await execute();
  } catch (error) {
    await deps.store.release(ref, token);
    throw error;
  }
  const saved = await deps.store.complete(
    ref,
    token,
    response,
    deps.clock.now(),
  );
  if (!saved)
    // Захват перехвачен после истечения срока: ответ уже выполненной команды отдаём, но
    // сохранить его для повтора нельзя. Событие нужно для разбора возможного повторного запуска.
    deps.logger.warn({
      event: 'idempotency_lease_lost',
      route: command.command,
    });
  return { ...response, replayed: false };
}
