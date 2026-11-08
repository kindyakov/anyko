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
      <Collapsible.Trigger className="group focus-visible:outline-brand flex min-h-11 w-full items-center justify-between gap-3 rounded-lg py-3 text-left text-sm font-medium focus-visible:outline-2">
        <span>{title}</span>
        <ChevronDown
          aria-hidden
          size={16}
          className="text-muted shrink-0 transition-transform group-data-[panel-open]:rotate-180"
        />
      </Collapsible.Trigger>
      <Collapsible.Panel keepMounted className="data-[closed]:hidden">
        <div className="pt-2 pb-4">{children}</div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
