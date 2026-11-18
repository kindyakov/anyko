import type { CommandResponse } from './application/ports';
import {
  type IdempotencyDeps,
  type IdempotentCommand,
  type IdempotentResult,
  runIdempotent,
} from './application/run';

export interface IdempotencyApi {
  // Выполняет команду один раз на ключ: повтор отдаёт сохранённый ответ (ADR 0009).
  run(
    command: IdempotentCommand,
    execute: () => Promise<CommandResponse>,
  ): Promise<IdempotentResult>;
}

export function createIdempotency(deps: IdempotencyDeps): IdempotencyApi {
  return {
    run: (command, execute) => runIdempotent(deps, command, execute),
  };
}
