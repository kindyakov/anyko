import type { Database } from '@anyko/database';

import { uuidV7 } from '../../../platform/ids';
import type { AuditRecord } from '../domain/events';

type AuditConnection = Pick<Database, 'auditEvent'>;

// Записывает событие в переданной транзакции. Фиксацию и откат решает тот же вызов, что и действие:
// если действие откатилось, события нет; если событие не записалось, откатывается и действие.
export async function record(
  tx: AuditConnection,
  event: AuditRecord,
): Promise<void> {
  await tx.auditEvent.create({
    data: {
      id: uuidV7(),
      workspaceId: event.workspaceId,
      actorId: event.actorId,
      action: event.action,
      targetKind: event.target.kind,
      targetId: event.target.id,
      ...(event.data === undefined ? {} : { data: event.data }),
      correlationId: event.correlationId ?? null,
    },
  });
}

// Способ записи события внутри транзакции: тесты подменяют его, чтобы проверить откат.
export type AuditWriter = (
  tx: AuditConnection,
  event: AuditRecord,
) => Promise<void>;
