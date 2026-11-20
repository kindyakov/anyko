'use client';

// shadcn/ui Base Nova message-scroller, adapted to Anyko tokens. See LICENSE.shadcn.md.
// https://ui.shadcn.com/r/styles/base-nova/message-scroller.json
import { MessageScroller as Primitive } from '@shadcn/react/message-scroller';
import { ArrowDown } from 'lucide-react';
import type { ComponentProps } from 'react';

import { Button } from '../button';

function Root({
  className = '',
  ...props
}: ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root
      data-slot="message-scroller"
      className={`relative flex min-h-0 flex-1 flex-col overflow-hidden ${className}`}
      {...props}
    />
  );
}

function Viewport({
  className = '',
  ...props
}: ComponentProps<typeof Primitive.Viewport>) {
  return (
    <Primitive.Viewport
      data-slot="message-scroller-viewport"
      className={`min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain outline-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:ring-inset data-pending-scroll:invisible ${className}`}
      {...props}
    />
  );
}

function Content({
  className = '',
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Content
      data-slot="message-scroller-content"
      className={`flex h-max min-h-full flex-col gap-5 ${className}`}
      {...props}
    />
  );
}

function Item({
  className = '',
  ...props
}: ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      data-slot="message-scroller-item"
      className={`min-w-0 shrink-0 ${className}`}
      {...props}
    />
  );
}

function ScrollButton({ label }: { label: string }) {
  return (
    <Primitive.Button
      render={<Button variant="secondary" size="icon-sm" />}
      className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full shadow-lg transition-opacity data-[active=false]:pointer-events-none data-[active=false]:opacity-0"
      aria-label={label}
      behavior="instant"
    >
      <ArrowDown size={17} aria-hidden />
    </Primitive.Button>
  );
}

export const MessageScroller = {
  Provider: Primitive.Provider,
  Root,
  Viewport,
  Content,
  Item,
  ScrollButton,
};
