import { z } from 'zod';

import type { ExecutionScope } from '../../modules/processing';
import { defineJob } from '../../platform/jobs';

export function workAnalysisJob(
  execute: (scope: ExecutionScope, signal: AbortSignal) => Promise<void>,
) {
  return defineJob({
    kind: 'run',
    name: 'work.analysis',
    version: 1,
    queue: 'llm',
    payload: z.object({}).strict(),
    timeoutMs: 1_500_000,
    retry: { attempts: 1, backoffMs: 0 },
    handler: (scope, _payload, signal) => execute(scope, signal),
  });
}
