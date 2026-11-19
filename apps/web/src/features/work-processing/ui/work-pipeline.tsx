'use client';
import { Progress } from '@base-ui/react/progress';
import { Sparkles } from 'lucide-react';

import { getWorkDocumentImage, type WorkView } from '@anyko/contracts/works';
import {
  Button,
  Disclosure,
  Notice,
  RelativeTime,
  Spinner,
  StatusPill,
  type Tone,
} from '@anyko/ui';
import { EventHorizon } from '@anyko/ui/brand';

import {
  analysisRuns,
  runProgress,
} from '@/features/work-processing/model/pipeline';
import { runStatusLabels } from '@/features/works';
import { endpointUrl } from '@/lib/api/call';
import { useWorkspaceId } from '@/lib/api/workspace';

import { RunView } from './pipeline/run-view';

type Run = WorkView['runs'][number];
type Document = WorkView['documents'][number];
type ImageUrl = (documentId: string, index: number) => string;

const runTones: Record<Run['status'], Tone> = {
  queued: 'neutral',
  running: 'progress',
  succeeded: 'success',
  partial: 'warning',
  failed: 'danger',
  cancelled: 'neutral',
};

export function WorkPipeline({
  view,
  analyzeDisabled,
  busy,
  onOpen,
  onAnalyze,
}: {
  view: WorkView;
  analyzeDisabled: boolean;
  busy: boolean;
  onOpen: (document: Document) => void;
  onAnalyze: () => void;
}) {
  const workspaceId = useWorkspaceId();
  // Изображения визуалов — изображения документов этой работы.
  const imageUrl: ImageUrl = (documentId, index) =>
    endpointUrl(getWorkDocumentImage, {
      params: {
        workspaceId,
        workId: view.work.id,
        documentId,
        index: String(index),
      },
      query: {
        revision: view.documents.find(({ id }) => id === documentId)
          ?.processingRevision,
      },
    });
  const analyses = analysisRuns(view.runs);
  const [current, ...previous] = analyses;
  const refreshSources =
    view.pendingUploadCount === 0 &&
    view.documents.length > 0 &&
    (!current ||
      (current.inputRevision !== undefined &&
        current.inputRevision !== view.work.inputRevision));
  if (!current)
    return (
      <section className="animate-rise glass flex flex-col items-center rounded-3xl border border-white/[0.08] bg-[radial-gradient(90%_120%_at_50%_0%,#2a0a12aa,transparent_60%)] px-6 py-14 text-center">
        <EventHorizon state="calm" className="size-44" />
        <h2 className="font-heading mt-8 text-2xl font-bold tracking-tight">
          Извлечение ещё не запускалось
        </h2>
        <p className="text-muted mt-3 max-w-md leading-7">
          {view.documents.length
            ? 'Anyko начнёт извлечение автоматически после распознавания файлов. Если файл не прочитан, проверьте его на шаге «Файлы».'
            : 'Сначала добавьте файлы клиента на шаге «Файлы».'}
        </p>
        {refreshSources && (
          <Button
            size="lg"
            className="mt-8"
            loading={busy}
            disabled={analyzeDisabled}
            onClick={onAnalyze}
          >
            <Sparkles size={18} />
            Обновить сведения
          </Button>
        )}
      </section>
    );
  const running = current.status === 'queued' || current.status === 'running';
  const { done, percent } = runProgress(current.steps);
  return (
    <div className="grid grid-cols-1 gap-8">
      <section
        aria-labelledby="run-title"
        className="glass relative overflow-hidden rounded-3xl border border-white/[0.08] p-5 sm:p-6"
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="run-title"
              className="font-heading text-xl font-bold tracking-tight"
            >
              {running ? 'Anyko читает файлы' : 'Последнее извлечение'}
            </h2>
            <p className="text-muted mt-1 text-sm">
              Запущено <RelativeTime value={current.createdAt} /> · этапов{' '}
              {done} из {current.steps.length}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill tone={runTones[current.status]}>
              {runStatusLabels[current.status]}
            </StatusPill>
            {!running &&
              (refreshSources ||
                current.status === 'failed' ||
                current.status === 'partial' ||
                current.status === 'cancelled') && (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={busy}
                  disabled={analyzeDisabled}
                  onClick={onAnalyze}
                >
                  <Sparkles size={15} />
                  {refreshSources
                    ? 'Обновить сведения'
                    : 'Повторить извлечение'}
                </Button>
              )}
          </div>
        </div>
        <Progress.Root value={percent} aria-label="Ход извлечения">
          <Progress.Track className="mb-5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <Progress.Indicator
              className={`block h-full rounded-full bg-[linear-gradient(90deg,#7a0a22,#db143c,#ff8aa3)] shadow-[0_0_12px_#db143c] transition-[width] duration-700 ease-out ${running ? 'animate-flow bg-size-[28px_100%]' : ''}`}
            />
          </Progress.Track>
        </Progress.Root>
        {running && (
          <p className="text-muted mb-5 flex items-center gap-2 text-xs">
            <Spinner className="size-3.5" />
            Можно закрыть страницу — обработка продолжится на сервере, а статусы
            обновятся сами.
          </p>
        )}
        {current.status === 'partial' && (
          <div className="mb-5">
            <Notice tone="warning" title="Часть этапов не выполнена">
              Сведения из успешно прочитанных файлов сохранены и доступны для
              проверки. Можно запустить извлечение заново.
            </Notice>
          </div>
        )}
        <RunView
          key={current.id}
          run={current}
          inputRevision={view.work.inputRevision}
          documents={view.documents}
          onOpen={onOpen}
          imageUrl={imageUrl}
        />
      </section>
      {previous.length > 0 && (
        <section aria-labelledby="history-title">
          <h3
            id="history-title"
            className="font-heading mb-3 text-base font-bold"
          >
            Предыдущие запуски
          </h3>
          <ul className="grid gap-2">
            {previous.slice(0, 5).map((run) => (
              <li
                key={run.id}
                className="glass rounded-2xl border border-white/[0.06] px-4"
              >
                <Disclosure
                  title={
                    <span className="flex flex-wrap items-center gap-3">
                      <StatusPill tone={runTones[run.status]}>
                        {runStatusLabels[run.status]}
                      </StatusPill>
                      <span className="text-muted text-xs font-normal">
                        <RelativeTime value={run.createdAt} />
                      </span>
                    </span>
                  }
                >
                  <RunView
                    run={run}
                    inputRevision={view.work.inputRevision}
                    documents={view.documents}
                    onOpen={onOpen}
                    imageUrl={imageUrl}
                  />
                </Disclosure>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
