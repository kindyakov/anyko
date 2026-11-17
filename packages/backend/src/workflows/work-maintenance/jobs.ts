import { z } from 'zod';

import { defineJob } from '../../platform/jobs';

export function workMaintenanceJob(cleanup: () => Promise<void>) {
  return defineJob({
    kind: 'scheduled',
    name: 'work.maintenance',
    version: 1,
    queue: 'maintenance',
    payload: z.object({}).strict(),
    timeoutMs: 300_000,
    retry: { attempts: 1, backoffMs: 0 },
    handler: async () => {
      await cleanup();
    },
  });
}
