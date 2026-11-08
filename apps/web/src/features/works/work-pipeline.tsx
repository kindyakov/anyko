'use client';
import { Progress } from '@base-ui/react/progress';
import {
  Check,
  Eye,
  GitMerge,
  ImageIcon,
  Minus,
  ScanText,
  Search,
  Sparkles,
  X,
} from 'lucide-react';

import type { WorkView } from '@anyko/contracts';

import { EventHorizon } from '@/components/cosmos/event-horizon';
import { Button } from '@/components/ui/button';
import { Disclosure } from '@/components/ui/disclosure';
import { FileIcon } from '@/components/ui/file-icon';
import { RelativeTime } from '@/components/ui/relative-time';
import { Spinner } from '@/components/ui/spinner';
import { stagger } from '@/components/ui/stagger';
import { Notice, StatusPill, type Tone } from '@/components/ui/status';
import {
  errorText,
  runStatusLabels,
  stageLabels,
  stepStatusLabels,
} from '@/features/works/journey';

type Run = WorkView['runs'][number];
type Step = Run['steps'][number];
type Document = WorkView['documents'][number];

const stageIcons = {
  parsing: ScanText,
  vision: ImageIcon,
  extraction: Search,
  reconciliation: GitMerge,
  generation: Sparkles,
} as const;
const runTones: Record<Run['status'], Tone> = {
  queued: 'neutral',
  running: 'progress',
  succeeded: 'success',
  partial: 'warning',
  failed: 'danger',
  cancelled: 'neutral',
};

function StepNode({ step }: { step: Step }) {
  const Icon = stageIcons[step.stage];
  const state = step.status;
  return (
    <div
      className="group/node flex min-w-0 flex-1 items-center gap-2"
      data-state={state}
    >
      <span
        className={`relative grid size-10 shrink-0 place-items-center rounded-full border transition-colors duration-500 ${
          state === 'succeeded'
            ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
            : state === 'running'
              ? 'border-[#ff3b62]/60 bg-[#db143c]/15 text-white shadow-[0_0_20px_-2px_#db143c]'
              : state === 'failed'
                ? 'border-red-400/50 bg-red-500/10 text-red-300'
                : 'border-white/10 bg-white/[0.02] text-zinc-500'
        }`}
      >
        {state === 'running' && (
          <span className="animate-orbit absolute -inset-1 rounded-full bg-[conic-gradient(from_0deg,transparent_60%,#ff3b62)] [mask:radial-gradient(farthest-side,transparent_calc(100%-2px),#000_calc(100%-1.5px))]" />
        )}
        <Icon size={16} aria-hidden />
        <span className="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full bg-[#0c0c0f]">
          {state === 'succeeded' ? (
            <Check size={11} className="text-emerald-300" strokeWidth={3} />
          ) : state === 'failed' ? (
            <X size={11} className="text-red-300" strokeWidth={3} />
          ) : state === 'skipped' ? (
            <Minus size={11} className="text-zinc-500" strokeWidth={3} />
          ) : null}
        </span>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium">
          {stageLabels[step.stage]}
        </span>
        <span
          className={`block text-[11px] ${state === 'failed' ? 'text-red-300' : state === 'running' ? 'text-rose-200' : 'text-muted'}`}
        >
          {stepStatusLabels[state]}
        </span>
      </span>
    </div>
  );
}

function Connector({ lit }: { lit: boolean }) {
  return (
    <span
      aria-hidden
      className={`hidden h-px w-6 shrink-0 sm:block ${lit ? 'bg-emerald-400/40' : 'animate-flow bg-[repeating-linear-gradient(90deg,#ffffff26_0_4px,transparent_4px_8px)] bg-size-[28px_1px]'}`}
    />
  );
}

function RunView({
  run,
  documents,
  onOpen,
}: {
  run: Run;
  documents: Document[];
  onOpen: (document: Document) => void;
}) {
  const groups = new Map<string | null, Step[]>();
  for (const step of run.steps) {
    const list = groups.get(step.documentId) ?? [];
    list.push(step);
    groups.set(step.documentId, list);
  }
  const failures = run.steps.filter((step) => step.errorCode);
  return (
    <div className="grid gap-3">
      {[...groups].map(([documentId, steps], index) => {
        const doc = documents.find((item) => item.id === documentId);
        const visuals = steps
          .filter((step) => step.stage === 'vision')
          .flatMap((step) =>
            step.visuals.map((visual) => ({
              ...visual,
              key: `${step.id}-${visual.path}`,
              documentId,
            })),
          );
        return (
          <div
            key={documentId ?? 'work'}
            className={`animate-rise glass rounded-2xl border border-white/[0.07] p-4 ${stagger(index)}`}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="flex min-w-0 items-center gap-3 lg:w-72">
                {documentId ? (
                  <FileIcon
                    filename={doc?.filename ?? ''}
                    className="size-10"
                  />
                ) : (
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300">
                    <GitMerge size={18} />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {documentId
                      ? (doc?.filename ?? 'Удалённый файл')
                      : 'Все файлы вместе'}
                  </p>
                  {doc?.status === 'succeeded' && (
                    <Button
                      variant="ghost"
                      size="xs"
                      className="mt-1"
                      onClick={() => {
                        onOpen(doc);
                      }}
                    >
                      <Eye size={13} /> Распознанный текст
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:flex-nowrap">
                {steps.map((step, i) => (
                  <div
                    key={step.id}
                    className="flex min-w-0 flex-1 basis-40 items-center gap-3"
                  >
                    {i > 0 && (
                      <Connector lit={steps[i - 1]?.status === 'succeeded'} />
                    )}
                    <StepNode step={step} />
                  </div>
                ))}
              </div>
            </div>
            {visuals.length > 0 && (
              <Disclosure
                className="mt-3 border-t border-white/[0.06] pt-1"
                title={
                  <span className="text-muted text-xs">
                    Что Anyko увидел на изображениях · {visuals.length}
                  </span>
                }
              >
                <ul className="grid gap-3 md:grid-cols-2">
                  {visuals.map((visual) => (
                    <li
                      key={visual.key}
                      className="flex gap-3 rounded-xl border border-white/[0.06] bg-black/30 p-3"
                    >
                      {visual.documentId && visual.imageIndex !== undefined && (
                        <img
                          src={`/api/documents/${visual.documentId}/images/${String(visual.imageIndex)}`}
                          alt="Изображение из файла"
                          loading="lazy"
                          className="size-20 shrink-0 rounded-lg bg-white object-cover"
                        />
                      )}
                      <p className="text-muted text-xs leading-5">
                        {visual.description}
                      </p>
                    </li>
                  ))}
                </ul>
              </Disclosure>
            )}
          </div>
        );
      })}
      {failures.map((step) => (
        <Notice
          key={step.id}
          tone="warning"
          title={`${stageLabels[step.stage]}: ${stepStatusLabels[step.status].toLowerCase()}`}
        >
          {errorText(step.errorCode ?? '')}
        </Notice>
      ))}
    </div>
  );
}

export function WorkPipeline({
  view,
  locked,
  busy,
  onOpen,
  onAnalyze,
}: {
  view: WorkView;
  locked: boolean;
  busy: boolean;
  onOpen: (document: Document) => void;
  onAnalyze: () => void;
}) {
  const analyses = view.runs
    .filter((run) => run.kind === 'analysis')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [current, ...previous] = analyses;
  if (!current)
    return (
      <section className="animate-rise glass flex flex-col items-center rounded-3xl border border-white/[0.08] bg-[radial-gradient(90%_120%_at_50%_0%,#2a0a12aa,transparent_60%)] px-6 py-14 text-center">
        <EventHorizon state="calm" className="size-44" />
        <h2 className="font-heading mt-8 text-2xl font-bold tracking-tight">
          Извлечение ещё не запускалось
        </h2>
        <p className="text-muted mt-3 max-w-md leading-7">
          {view.documents.length
            ? 'Запустите его — Anyko прочитает каждый файл и найдёт сведения для документов. Здесь будет видно, что происходит с каждым файлом.'
            : 'Сначала добавьте файлы клиента на шаге «Файлы».'}
        </p>
        {view.documents.length > 0 && (
          <Button
            size="lg"
            className="mt-8"
            loading={busy}
            disabled={locked}
            onClick={onAnalyze}
          >
            <Sparkles size={18} />
            Извлечь сведения
          </Button>
        )}
      </section>
    );
  const running = current.status === 'queued' || current.status === 'running';
  const done = current.steps.filter(
    (step) => step.status !== 'queued' && step.status !== 'running',
  ).length;
  const percent = current.steps.length
    ? Math.round((done / current.steps.length) * 100)
    : 0;
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
            {!running && (
              <Button
                variant="secondary"
                size="sm"
                loading={busy}
                disabled={locked}
                onClick={onAnalyze}
              >
                <Sparkles size={15} />
                Извлечь заново
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
        <RunView run={current} documents={view.documents} onOpen={onOpen} />
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
                    documents={view.documents}
                    onOpen={onOpen}
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
