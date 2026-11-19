import type { WorkAttempt } from '../../modules/processing';
import type { WorkSummary } from '../../modules/works';
import type { WorkDependencies } from '../work-dependencies';

export function analysisContextRevision(work: WorkSummary) {
  // Source membership is fixed for the run, so additions to later groups
  // do not invalidate the current context. Fact edits still change this revision.
  return work.revision - work.inputRevision;
}

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
        (run.kind === 'generation' &&
          work.inputRevision !== run.inputRevision) ||
        docs.some((doc) => doc.deleted) ||
        (run.kind === 'analysis' &&
          run.documentIds.some((id) => !docs.some((doc) => doc.id === id)))
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
