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

import type { WorkView } from '@anyko/contracts/works';

import { stageLabels, stepStatusLabels } from '@/features/works';

type Step = WorkView['runs'][number]['steps'][number];

const stageIcons = {
  parsing: ScanText,
  vision: ImageIcon,
  extraction: Search,
  reconciliation: GitMerge,
  generation: Sparkles,
} as const;
export function StepNode({ step }: { step: Step }) {
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

export function Connector({ lit }: { lit: boolean }) {
  return (
    <span
      aria-hidden
      className={`hidden h-px w-6 shrink-0 sm:block ${lit ? 'bg-emerald-400/40' : 'animate-flow bg-[repeating-linear-gradient(90deg,#ffffff26_0_4px,transparent_4px_8px)] bg-size-[28px_1px]'}`}
    />
  );
}
