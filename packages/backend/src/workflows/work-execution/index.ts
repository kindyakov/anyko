import { LlmError } from '@anyko/llm';

import { createWorkAnalysis } from '../work-analysis';
import type { WorkDependencies } from '../work-dependencies';
import { createWorkGenerationRun } from '../work-generation/run-generation';

// Исполнение запуска работы: захват попытки, блокировки, выбор анализа или генерации и итог при сбое.
export function createWorkExecution(deps: WorkDependencies) {
  const analysis = createWorkAnalysis(deps);
  const generation = createWorkGenerationRun(deps);

  return async (workspaceId: string, runId: string, signal: AbortSignal) => {
    await deps.locks.run(
      `work-run:${workspaceId}:${runId}`,
      async (lockSignal) => {
        const run = await deps.processing.internal.claim(workspaceId, runId);
        if (!run) return;
        deps.logger.info({
          event: 'work_started',
          jobId: run.id,
          jobType: run.kind,
          correlationId: run.correlationId,
        });
        const bounded = AbortSignal.any([
          signal,
          lockSignal,
          AbortSignal.timeout(1_500_000),
        ]);
        const guarded = (index: number): Promise<void> => {
          const id = run.documentIds[index];
          return id
            ? deps.documentIo.run({ workspaceId, documentId: id }, () =>
                guarded(index + 1),
              )
            : run.kind === 'analysis'
              ? analysis(run, bounded)
              : generation(run, bounded);
        };
        try {
          await deps.workIo.run(workspaceId, run.workId, () => guarded(0));
        } catch (error) {
          await deps.processing.internal.finish(
            run,
            bounded.aborted ? 'cancelled' : 'failed',
            error instanceof LlmError ? error.code : 'WORK_PROCESSING_FAILED',
          );
          if (run.generationId)
            await deps.generation.internal.fail(workspaceId, run.generationId);
          await deps.works.internal.event(
            workspaceId,
            run.workId,
            'processing.failed',
          );
          deps.logger.error({
            event: 'work_processing_failed',
            correlationId: run.correlationId,
            errorCode:
              error instanceof LlmError ? error.code : 'WORK_PROCESSING_FAILED',
          });
        }
      },
    );
  };
}
