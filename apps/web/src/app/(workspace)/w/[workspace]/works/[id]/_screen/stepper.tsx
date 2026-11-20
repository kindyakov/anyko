'use client';
import { Tabs } from '@base-ui/react/tabs';
import { Check } from 'lucide-react';

import { journeySteps, type StepKey } from '@/features/works';

export function Stepper({ current }: { current: StepKey }) {
  const currentIndex = journeySteps.findIndex((step) => step.key === current);
  return (
    <Tabs.List
      aria-label="Шаги работы"
      className="glass relative grid grid-cols-2 gap-1.5 rounded-2xl border border-white/[0.07] p-1.5 lg:grid-cols-4"
    >
      <Tabs.Indicator className="absolute top-0 left-0 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) translate-y-(--active-tab-top) rounded-xl bg-[linear-gradient(180deg,#ffffff12,#ffffff06)] shadow-[inset_0_1px_0_#ffffff14,0_0_0_1px_#ff3b6240,0_10px_30px_-12px_#db143c] transition-[translate,width,height] duration-300 ease-out" />
      {journeySteps.map((step, index) => {
        const done = index < currentIndex;
        const now = index === currentIndex;
        return (
          <Tabs.Tab
            key={step.key}
            value={step.key}
            className="group focus-visible:outline-brand-hot relative z-10 flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-2"
          >
            <span
              className={`relative grid size-8 shrink-0 place-items-center rounded-full border text-xs font-bold transition-colors ${done ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' : now ? 'border-[#ff3b62]/70 bg-[#db143c]/20 text-white shadow-[0_0_16px_-2px_#db143c]' : 'border-white/10 text-zinc-500'}`}
            >
              {now && (
                <span className="animate-horizon absolute -inset-1 rounded-full border border-[#ff3b62]/40" />
              )}
              {done ? <Check size={14} strokeWidth={3} /> : index + 1}
            </span>
            <span className="min-w-0">
              <span className="text-muted block text-sm font-medium transition-colors group-aria-selected:text-white">
                {step.title}
              </span>
              <span className="text-muted hidden truncate text-[11px] sm:block">
                {now ? 'Текущий шаг' : step.caption}
              </span>
            </span>
          </Tabs.Tab>
        );
      })}
    </Tabs.List>
  );
}
