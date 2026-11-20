import { stagger } from '@anyko/ui';

import { journeySteps } from '@/features/works/model/journey';

export function Journey({ compact = false }: { compact?: boolean }) {
  return (
    <ol
      className={`grid gap-2 ${compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-4'}`}
    >
      {journeySteps.map((step, index) => (
        <li
          key={step.key}
          className={`animate-rise glass relative rounded-2xl border border-white/[0.07] p-3.5 ${stagger(index * 2)}`}
        >
          <span className="font-heading text-brand-hot text-xs font-bold">
            0{index + 1}
          </span>
          <p className="mt-1 text-sm font-medium">{step.title}</p>
          <p className="text-muted mt-0.5 text-xs leading-5">{step.caption}</p>
        </li>
      ))}
    </ol>
  );
}
