import { LlmError } from '@anyko/llm';

import { isAppError } from '../../platform/errors';
import type { RunPolicy } from '../../platform/jobs';
import { createWorkAnalysis } from '../work-analysis';
import type { WorkDependencies } from '../work-dependencies';
import { createWorkGenerationRun } from '../work-generation/run-generation';

// Исполнение запуска работы: захват попытки, блокировки, выбор анализа или генерации и итог при сбое.
export function createWorkExecution(deps: WorkDependencies) {
  const analysis = createWorkAnalysis(deps);
  const generation = createWorkGenerationRun(deps);

  return async (
    workspaceId: string,
    runId: string,
    signal: AbortSignal,
    connection: RunPolicy['connection'],
  ) => {
    await deps.locks.run(
      `work-run:${workspaceId}:${runId}`,
      async (lockSignal) => {
        const attempt = await deps.processing.claimAttempt(workspaceId, runId);
        if (!attempt) return;
        const { run } = attempt;
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
        const execute = () => {
          if ((run.kind === 'analysis') !== (connection === 'required'))
            throw new Error('RUN_CONNECTION_POLICY_MISMATCH');
          return connection === 'required'
            ? analysis(attempt, bounded, (revision) =>
                deps.connections.internal.connection(run.workspaceId, revision),
              )
            : generation(attempt, bounded);
        };
        const guarded = (index: number): Promise<void> => {
          const id = run.documentIds[index];
          return id
            ? deps.io.run(
                { kind: 'document', workspaceId, documentId: id },
                () => guarded(index + 1),
              )
            : execute();
        };
        try {
          await deps.io.run(
            { kind: 'work', workspaceId, workId: run.workId },
            () => guarded(0),
          );
        } catch (error) {
          const errorCode =
            error instanceof LlmError || isAppError(error)
              ? error.code
              : 'WORK_PROCESSING_FAILED';
          const finished = await attempt.finish(
            { status: bounded.aborted ? 'cancelled' : 'failed', errorCode },
            async (tx) => {
              if (run.generationId)
                await deps.generation
                  .in(tx)
                  .internal.fail(workspaceId, run.generationId);
              await deps.works
                .in(tx)
                .internal.event(workspaceId, run.workId, 'processing.failed');
            },
          );
          if (!finished) return;
          deps.logger.error({
            event: 'work_processing_failed',
            correlationId: run.correlationId,
            errorCode,
          });
        }
      },
    );
  };
}
