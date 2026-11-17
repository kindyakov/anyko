import { z } from 'zod';

import type { ExecutionScope } from '../../modules/processing';
import { defineJob } from '../../platform/jobs';

export function documentOcrJob(
  execute: (scope: ExecutionScope, signal: AbortSignal) => Promise<void>,
  timeoutMs: number,
) {
  return defineJob({
    kind: 'run',
    connection: 'none',
    maxRunAttempts: 3,
    redeliverQueued: true,
    name: 'document.ocr',
    version: 1,
    queue: 'ocr',
    payload: z.object({}).strict(),
    timeoutMs,
    retry: { attempts: 1, backoffMs: 0 },
    handler: (scope, _payload, signal) => execute(scope, signal),
  });
}
