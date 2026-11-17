import type { JobRuntime } from '@anyko/backend/jobs';

/** Recovery rules belong to processing; this loop only schedules their execution. */
export async function reconcileJobs(runtime: Pick<JobRuntime, 'reconcile'>) {
  await runtime.reconcile();
}
