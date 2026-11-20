'use client';
import { Collapsible } from '@base-ui/react/collapsible';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

export function Disclosure({
  title,
  children,
  className = '',
  ...props
}: Omit<Collapsible.Root.Props, 'title' | 'className'> & {
  title: ReactNode;
  className?: string;
}) {
  return (
    <Collapsible.Root {...props} className={className}>
      <Collapsible.Trigger className="group focus-visible:outline-brand-hot flex min-h-11 w-full items-center justify-between gap-3 rounded-lg py-2 text-left text-sm font-medium transition-colors hover:text-white focus-visible:outline-2">
        <span className="min-w-0">{title}</span>
        <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.03] transition-colors group-hover:border-white/20">
          <ChevronDown
            aria-hidden
            size={15}
            className="text-muted transition-transform duration-300 group-data-[panel-open]:rotate-180"
          />
        </span>
      </Collapsible.Trigger>
      <Collapsible.Panel
        keepMounted
        className="h-(--collapsible-panel-height) overflow-hidden transition-[height,opacity] duration-300 ease-out data-[closed]:opacity-0 data-[ending-style]:h-0 data-[starting-style]:h-0 [&[hidden]:not([hidden='until-found'])]:hidden"
      >
        <div className="pt-2 pb-3">{children}</div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
