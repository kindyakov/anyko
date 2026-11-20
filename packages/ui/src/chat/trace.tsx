'use client';

// shadcn/ui Base Nova Trace, composed with its Base UI Collapsible.
// https://ui.shadcn.com/r/styles/base-nova/trace.json · See LICENSE.shadcn.md.
import { Collapsible } from '@base-ui/react/collapsible';
import { ChevronRight } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

export function Trace({ className = '', ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="trace"
      className={`flex w-full min-w-0 flex-col gap-2 ${className}`}
      {...props}
    />
  );
}

export function TraceStep({
  title,
  icon,
  children,
  className = '',
}: {
  title: ReactNode;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Collapsible.Root
      data-slot="trace-collapsible"
      className={`flex w-full min-w-0 flex-col ${className}`}
    >
      <Collapsible.Trigger
        data-slot="trace-collapsible-trigger"
        className="group/trace-trigger text-muted hover:text-ink focus-visible:outline-brand-hot flex min-h-9 w-full min-w-0 items-center gap-2 rounded-md text-left transition-colors focus-visible:outline-2"
      >
        <span
          aria-hidden
          className="flex size-4 shrink-0 items-center justify-center"
        >
          {icon}
        </span>
        <span
          data-slot="trace-title"
          className="min-w-0 flex-1 text-sm wrap-anywhere"
        >
          {title}
        </span>
        <ChevronRight
          aria-hidden
          size={16}
          className="shrink-0 transition-transform group-aria-expanded/trace-trigger:rotate-90"
        />
      </Collapsible.Trigger>
      <Collapsible.Panel
        data-slot="trace-collapsible-content"
        className="h-(--collapsible-panel-height) min-w-0 overflow-hidden transition-[height] duration-200 data-ending-style:h-0 data-starting-style:h-0"
      >
        <div className="my-2 ml-1.5 min-w-0 border-l border-white/12 pl-3 wrap-anywhere">
          {children}
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
