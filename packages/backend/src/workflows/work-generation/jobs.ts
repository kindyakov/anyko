import { z } from 'zod';

import type { ExecutionScope } from '../../modules/processing';
import { defineJob, type RunPolicy } from '../../platform/jobs';

export function workGenerationJob(
  execute: (
    scope: ExecutionScope,
    signal: AbortSignal,
    connection: RunPolicy['connection'],
  ) => Promise<void>,
) {
  const connection = 'none';
  return defineJob({
    kind: 'run',
    connection,
    maxRunAttempts: null,
    redeliverQueued: false,
    name: 'work.generation',
    version: 1,
    queue: 'render',
    payload: z.object({}).strict(),
    timeoutMs: 1_500_000,
    retry: { attempts: 1, backoffMs: 0 },
    handler: (scope, _payload, signal) => execute(scope, signal, connection),
  });
}
