import type { WorkAttempt } from '../../modules/processing';
import type { WorkDependencies } from '../work-dependencies';

// Входы работы могут измениться независимо от состояния попытки.
export function createRunState(
  deps: Pick<WorkDependencies, 'works' | 'logger'>,
  attempt: WorkAttempt,
) {
  const { run } = attempt;
  return {
    current: async () => {
      const work = await deps.works.internal.get(run.workspaceId, run.workId);
      const docs = await deps.works.internal.documents(
        run.workspaceId,
        run.workId,
      );
      if (
        !work ||
        work.inputRevision !== run.inputRevision ||
        docs.some((doc) => doc.deleted)
      )
        throw new Error('STALE_WORK_ATTEMPT');
      await attempt.assertCurrent();
      return work;
    },
    step: async (input: Parameters<WorkAttempt['step']>[0]) => {
      await attempt.step(input);
      deps.logger.info({
        event: 'work_step_changed',
        jobId: run.id,
        jobType: input.stage,
        state: input.status,
        correlationId: run.correlationId,
      });
      await deps.works.internal.event(
        run.workspaceId,
        run.workId,
        'processing.changed',
      );
    },
  };
}
