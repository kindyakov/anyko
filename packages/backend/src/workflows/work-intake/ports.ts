import type { AgentSessionStore } from '../../modules/agents';
import type { Tx } from '../../platform/transactions';

// Сессия работы внутри транзакции создания: фасад agents ещё не выделен (этап 5b), поэтому
// порт назван по нужной операции. Реализация — storeFor(tx) модуля agents в composition root.
export interface WorkSessionPort {
  in(tx: Tx): Pick<AgentSessionStore, 'ensure'>;
}
