import type { ProcessingModule, WorkRunRecord } from '../../modules/processing';
import type { WorkSummary } from '../../modules/works';
import type { WorkDependencies } from '../work-dependencies';

type StepInput = Parameters<ProcessingModule['internal']['step']>[1];

export interface RunState {
  // Проверяет, что запуск ещё актуален: ревизия входа, исходники и попытка совпадают.
  current(run: WorkRunRecord): Promise<WorkSummary>;
  // Пишет шаг запуска и событие работы; вызывается вне транзакции.
  step(run: WorkRunRecord, input: StepInput): Promise<void>;
}

// Общие шаги исполнения анализа и генерации: одна проверка актуальности и одна запись шага.
export function createRunState(
  deps: Pick<WorkDependencies, 'works' | 'processing' | 'logger'>,
): RunState {
  const current = async (run: WorkRunRecord) => {
    const work = await deps.works.internal.get(run.workspaceId, run.workId);
    const docs = await deps.works.internal.documents(
      run.workspaceId,
      run.workId,
    );
    if (
      !work ||
      work.inputRevision !== run.inputRevision ||
      docs.some((doc) => doc.deleted) ||
      !(await deps.processing.internal.valid(run))
    )
      throw new Error('STALE_WORK_ATTEMPT');
    return work;
  };
  const step = async (run: WorkRunRecord, input: StepInput) => {
    await deps.processing.internal.step(run, input);
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
  };
  return { current, step };
}
