import { z } from 'zod';

import { defineJob } from '../../platform/jobs';

import type { createIdempotencyMaintenance } from './maintenance';

export function idempotencyCleanupJob(
  maintenance: ReturnType<typeof createIdempotencyMaintenance>,
) {
  return defineJob({
    kind: 'scheduled',
    name: 'idempotency.cleanup',
    version: 1,
    queue: 'maintenance',
    payload: z.object({}).strict(),
    timeoutMs: 30000,
    retry: { attempts: 1, backoffMs: 0 },
    handler: (context) => maintenance.internal.cleanup(context.signal),
  });
}
