import { z } from 'zod';

import type { ExecutionScope } from '../../modules/processing';
import { defineJob, type RunPolicy } from '../../platform/jobs';

export function workChatJob(
  execute: (
    scope: ExecutionScope,
    signal: AbortSignal,
    connection: RunPolicy['connection'],
  ) => Promise<void>,
) {
  const connection = 'required';
  return defineJob({
    kind: 'run',
    connection,
    maxRunAttempts: null,
    redeliverQueued: true,
    name: 'work.chat',
    version: 1,
    queue: 'llm',
    payload: z.object({}).strict(),
    timeoutMs: 1_500_000,
    retry: { attempts: 1, backoffMs: 0 },
    handler: (scope, _payload, signal) => execute(scope, signal, connection),
  });
}
