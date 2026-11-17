// Владелец кодов повтора команды: HTTP-каталог (contracts) сверяется с этим объектом.
import { defineErrors } from '../../platform/errors';

export const IdempotencyErrors = defineErrors({
  IDEMPOTENCY_CONFLICT: 'conflict',
  IDEMPOTENCY_IN_PROGRESS: 'conflict',
});

export class IdempotencyFailure extends IdempotencyErrors.Failure {}
