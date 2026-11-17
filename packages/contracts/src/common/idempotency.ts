import { z } from 'zod';

// Заголовок Idempotency-Key (ADR 0008, ADR 0009): UUID, который web создаёт на одно намеренное
// действие и переиспользует при автоматическом повторе. endpoint() добавляет его сам для режима key.
export const idempotencyKeyHeaders = z.object({
  'idempotency-key': z.uuid(),
});
