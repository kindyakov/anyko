import {
  Check,
  GitMerge,
  ImageIcon,
  Minus,
  ScanText,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useState } from 'react';

import type { WorkView } from '@anyko/contracts/works';

import { stageLabels, stepStatusLabels } from '@/features/works';

type Step = WorkView['runs'][number]['steps'][number];
type Status = Step['status'];

const stageIcons = {
  parsing: ScanText,
  vision: ImageIcon,
  extraction: Search,
  reconciliation: GitMerge,
  generation: Sparkles,
} as const;

const after = (delay: number, offset = 0) => ({
  animationDelay: `${String(delay + offset)}ms`,
});

/**
 * Узел этапа. `delay` выстраивает появление слева направо; при смене статуса
 * от узла расходится кольцо — сразу, без задержки появления.
 */
export function StepNode({ step, delay }: { step: Step; delay: number }) {
  const Icon = stageIcons[step.stage];
  const state = step.status;
  // Статус при первом показе: только его отклик ждёт своей очереди в появлении.
  const [initial] = useState(state);
  const settled = state === 'succeeded' || state === 'failed';
  return (
    <div
      className="group/node flex min-w-0 flex-1 items-center gap-2"
      data-state={state}
    >
      <span
        style={after(delay)}
        className={`animate-pop relative grid size-10 shrink-0 place-items-center rounded-full border transition-[color,background-color,border-color] duration-700 ease-out ${
          state === 'succeeded'
            ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
            : state === 'running'
              ? 'border-[#ff3b62]/60 bg-[#db143c]/15 text-white'
              : state === 'failed'
                ? 'border-red-400/50 bg-red-500/10 text-red-300'
                : 'border-white/10 bg-white/[0.02] text-zinc-500'
        }`}
      >
        {state === 'running' && (
          <>
            <span
              aria-hidden
              className="animate-breathe absolute inset-0 rounded-full"
            />
            <span
              aria-hidden
              className="animate-orbit absolute -inset-1 rounded-full bg-[conic-gradient(from_0deg,transparent_55%,#ff3b62)] [mask:radial-gradient(farthest-side,transparent_calc(100%-2px),#000_calc(100%-1.5px))]"
            />
          </>
        )}
        {settled && (
          <span
            key={`ripple-${state}`}
            aria-hidden
            style={after(state === initial ? delay : 0, 260)}
            className={`animate-ripple pointer-events-none absolute inset-0 rounded-full border ${state === 'succeeded' ? 'border-emerald-300/70' : 'border-red-300/70'}`}
          />
        )}
        <Icon size={16} aria-hidden className="relative" />
        <span
          key={`badge-${state}`}
          style={after(state === initial ? delay : 0, 220)}
          className="animate-pop absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full bg-[#0c0c0f]"
        >
          {state === 'succeeded' ? (
            <Check size={11} className="text-emerald-300" strokeWidth={3} />
          ) : state === 'failed' ? (
            <X size={11} className="text-red-300" strokeWidth={3} />
          ) : state === 'skipped' ? (
            <Minus size={11} className="text-zinc-500" strokeWidth={3} />
          ) : null}
        </span>
      </span>
      <span style={after(delay, 90)} className="animate-slide min-w-0">
        <span className="block truncate text-xs font-medium">
          {stageLabels[step.stage]}
        </span>
        <span
          className={`block text-[11px] transition-colors duration-700 ${state === 'failed' ? 'text-red-300' : state === 'running' ? 'text-rose-200' : 'text-muted'}`}
        >
          {stepStatusLabels[state]}
        </span>
      </span>
    </div>
  );
}

/**
 * Связь между этапами прорисовывается слева направо. По связи к идущему этапу
 * бежит огонёк, по завершённой однократно проходит блик.
 */
export function Connector({
  from,
  to,
  delay,
}: {
  from: Status | undefined;
  to: Status;
  delay: number;
}) {
  const kind =
    to === 'running'
      ? 'active'
      : from === 'succeeded'
        ? 'done'
        : from === 'skipped' && to !== 'queued'
          ? 'passed'
          : 'waiting';
  return (
    <span
      aria-hidden
      style={after(delay)}
      className={`animate-draw relative hidden h-px w-6 shrink-0 origin-left overflow-x-clip transition-colors duration-700 sm:block ${
        kind === 'done'
          ? 'bg-emerald-400/40'
          : kind === 'active'
            ? 'bg-[#ff3b62]/20'
            : kind === 'passed'
              ? 'bg-white/15'
              : 'bg-[repeating-linear-gradient(90deg,#ffffff24_0_3px,transparent_3px_7px)]'
      }`}
    >
      {kind === 'active' && (
        <span className="animate-comet absolute inset-y-0 left-0 w-1/2 rounded-full bg-[linear-gradient(90deg,transparent,#ff8aa3,transparent)] shadow-[0_0_6px_#ff3b62]" />
      )}
      {kind === 'done' && (
        <span
          style={after(delay, 450)}
          className="animate-sheen absolute inset-y-0 left-0 w-1/2 bg-[linear-gradient(90deg,transparent,#a7f3d0,transparent)] opacity-0"
        />
      )}
    </span>
  );
}
