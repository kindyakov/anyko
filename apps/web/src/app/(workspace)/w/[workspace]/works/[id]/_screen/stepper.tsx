'use client';
import { Tabs } from '@base-ui/react/tabs';
import { AlertTriangle, Check } from 'lucide-react';

import { workSourceLimit, type WorkView } from '@anyko/contracts/works';

import { journeySteps, type StepKey, type WorkStage } from '@/features/works';

type Tone = 'muted' | 'progress' | 'danger' | 'warning' | 'success';
type Meta = { caption: string; tone: Tone; error?: boolean; badge?: number };

const captionTones: Record<Tone, string> = {
  muted: 'text-muted',
  progress: 'text-sky-300',
  danger: 'text-red-300',
  warning: 'text-amber-300',
  success: 'text-emerald-300',
};

// Подпись шага — живое состояние этапа, а не статичное описание.
function stepMeta(
  view: WorkView,
  stage: WorkStage,
  review: { complete: number; total: number; attention: number },
): Record<StepKey, Meta> {
  const failed = view.documents.filter(({ status }) => status === 'failed');
  const reading = view.documents.filter(
    ({ status }) => status === 'queued' || status === 'running',
  );
  const last = view.runs
    .filter(({ kind }) => kind === 'analysis')
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const confirmed = view.work.confirmedRevision === view.work.revision;
  return {
    files: failed.length
      ? {
          caption: `С ошибкой: ${String(failed.length)}`,
          tone: 'danger',
          error: true,
        }
      : reading.length
        ? {
            caption: `Распознаётся: ${String(reading.length)}`,
            tone: 'progress',
          }
        : {
            caption: view.documents.length
              ? `${String(view.documents.length)} из ${String(workSourceLimit)}`
              : 'Нет файлов',
            tone: 'muted',
          },
    extraction:
      stage.kind === 'processing'
        ? {
            caption: `Этапов ${String(stage.done)} из ${String(stage.total)}`,
            tone: 'progress',
          }
        : stage.kind === 'failed'
          ? { caption: 'Не удалось', tone: 'danger', error: true }
          : !last
            ? { caption: 'Не запускалось', tone: 'muted' }
            : last.status === 'partial'
              ? { caption: 'Выполнено частично', tone: 'warning' }
              : { caption: 'Готово', tone: 'muted' },
    review: confirmed
      ? { caption: 'Подтверждено', tone: 'success' }
      : {
          caption: review.total
            ? `Заполнено ${String(review.complete)} из ${String(review.total)}`
            : 'Нет полей',
          tone: 'muted',
          ...(review.attention > 0 && { badge: review.attention }),
        },
    documents:
      stage.kind === 'generating'
        ? { caption: 'Формируется', tone: 'progress' }
        : stage.kind === 'generated'
          ? { caption: `Готово: ${String(stage.files)}`, tone: 'success' }
          : confirmed
            ? { caption: 'Можно формировать', tone: 'muted' }
            : { caption: 'После проверки', tone: 'muted' },
  };
}

export function Stepper({
  current,
  view,
  stage,
  review,
}: {
  /** Шаг, на котором находится работа; выбранную вкладку показывает индикатор. */
  current: StepKey;
  view: WorkView;
  stage: WorkStage;
  review: { complete: number; total: number; attention: number };
}) {
  const currentIndex = journeySteps.findIndex((step) => step.key === current);
  const meta = stepMeta(view, stage, review);
  return (
    <Tabs.List
      aria-label="Шаги работы"
      className="glass relative grid grid-cols-2 gap-1.5 rounded-2xl border border-white/[0.07] p-1.5 lg:grid-cols-4"
    >
      <Tabs.Indicator className="absolute top-0 left-0 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) translate-y-(--active-tab-top) rounded-xl bg-[linear-gradient(180deg,#ffffff12,#ffffff06)] shadow-[inset_0_1px_0_#ffffff14,0_0_0_1px_#ffffff1f,0_10px_30px_-16px_#000] transition-[translate,width,height] duration-300 ease-out" />
      {journeySteps.map((step, index) => {
        const { caption, tone, error, badge } = meta[step.key];
        const done = !error && index < currentIndex;
        const now = !error && index === currentIndex;
        return (
          <Tabs.Tab
            key={step.key}
            value={step.key}
            className="group focus-visible:outline-brand-hot relative z-10 flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-2"
          >
            <span
              className={`relative grid size-8 shrink-0 place-items-center rounded-full border text-xs font-bold transition-colors ${error ? 'border-red-400/40 bg-red-500/10 text-red-300' : done ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' : now ? 'border-[#ff3b62]/70 bg-[#db143c]/20 text-white shadow-[0_0_16px_-2px_#db143c]' : 'border-white/10 text-zinc-500'}`}
            >
              {now && (
                <span className="animate-horizon absolute -inset-1 rounded-full border border-[#ff3b62]/40" />
              )}
              {error ? (
                <AlertTriangle size={14} strokeWidth={2.5} aria-hidden />
              ) : done ? (
                <Check size={14} strokeWidth={3} aria-hidden />
              ) : (
                index + 1
              )}
            </span>
            <span className="min-w-0">
              <span className="text-muted flex items-center gap-1.5 text-sm font-medium transition-colors group-aria-selected:text-white">
                {step.title}
                {badge !== undefined && (
                  <span className="grid h-4 min-w-4 place-items-center rounded-full bg-amber-400/15 px-1 text-[10px] leading-none font-bold text-amber-300 tabular-nums">
                    <span className="sr-only">требуют внимания:</span>
                    {badge}
                  </span>
                )}
              </span>
              <span
                className={`block truncate text-[11px] tabular-nums ${captionTones[tone]}`}
              >
                {caption}
              </span>
            </span>
          </Tabs.Tab>
        );
      })}
    </Tabs.List>
  );
}
