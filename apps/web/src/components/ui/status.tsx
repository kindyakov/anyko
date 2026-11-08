import {
  AlertTriangle,
  Check,
  CircleDashed,
  Info,
  type LucideIcon,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { Spinner } from '@/components/ui/spinner';

export type Tone =
  'neutral' | 'progress' | 'success' | 'warning' | 'danger' | 'brand';

const pills: Record<Tone, string> = {
  neutral: 'bg-white/[0.05] text-zinc-300 ring-white/10',
  progress: 'bg-sky-400/10 text-sky-200 ring-sky-400/25',
  success: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25',
  warning: 'bg-amber-400/10 text-amber-200 ring-amber-400/25',
  danger: 'bg-red-500/10 text-red-300 ring-red-400/25',
  brand: 'bg-brand/12 text-rose-200 ring-brand/35',
};
const icons: Record<Tone, LucideIcon | null> = {
  neutral: CircleDashed,
  progress: null,
  success: Check,
  warning: AlertTriangle,
  danger: X,
  brand: null,
};

/** A status always carries an icon and a word, never colour alone. */
export function StatusPill({
  tone,
  children,
  className = '',
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  const Icon = icons[tone];
  return (
    <span
      className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs leading-none font-medium whitespace-nowrap ring-1 ring-inset ${pills[tone]} ${className}`}
    >
      {tone === 'progress' ? (
        <Spinner className="size-3" />
      ) : tone === 'brand' ? (
        <span className="bg-brand-hot animate-blink size-1.5 rounded-full shadow-[0_0_6px_#ff3b62]" />
      ) : (
        Icon && <Icon size={12} strokeWidth={2.5} aria-hidden />
      )}
      {children}
    </span>
  );
}

const notices: Record<Exclude<Tone, 'brand'>, string> = {
  neutral: 'border-white/10 bg-white/[0.03] text-zinc-300',
  progress: 'border-sky-400/20 bg-sky-400/[0.06] text-sky-100',
  success: 'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-100',
  warning: 'border-amber-400/25 bg-amber-400/[0.06] text-amber-100',
  danger: 'border-red-400/25 bg-red-500/[0.07] text-red-100',
};

export function Notice({
  tone,
  title,
  children,
  action,
  role,
}: {
  tone: Exclude<Tone, 'brand'>;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  role?: 'alert' | 'status';
}) {
  const Icon =
    tone === 'progress' ? null : tone === 'neutral' ? Info : icons[tone];
  return (
    <div
      role={role}
      className={`animate-rise flex flex-wrap items-start gap-3 rounded-2xl border p-4 text-sm leading-6 ${notices[tone]}`}
    >
      <span className="mt-0.5 shrink-0">
        {Icon ? <Icon size={18} aria-hidden /> : <Spinner className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="opacity-85">{children}</div>}
      </div>
      {action}
    </div>
  );
}
