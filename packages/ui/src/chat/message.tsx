// shadcn/ui Base Nova Message and Bubble, with the variants used by the chat.
// https://ui.shadcn.com/docs/ai-elements/base/chat · See LICENSE.shadcn.md.
import type { ComponentProps } from 'react';

type Alignment = 'start' | 'end';

export function Message({
  align = 'start',
  className = '',
  ...props
}: ComponentProps<'div'> & { align?: Alignment }) {
  return (
    <div
      data-slot="message"
      data-align={align}
      className={`group/message relative flex w-full min-w-0 gap-2.5 text-sm data-[align=end]:flex-row-reverse ${className}`}
      {...props}
    />
  );
}

export function MessageContent({
  className = '',
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-content"
      className={`flex w-full min-w-0 flex-col gap-2 wrap-break-word group-data-[align=end]/message:*:data-slot:self-end ${className}`}
      {...props}
    />
  );
}

export function Bubble({
  variant = 'muted',
  ...props
}: ComponentProps<'div'> & { variant?: 'muted' | 'ghost' }) {
  return (
    <div
      data-slot="bubble"
      data-variant={variant}
      className="group/bubble relative flex w-fit max-w-[85%] min-w-0 flex-col group-data-[align=end]/message:self-end data-[variant=ghost]:max-w-full"
      {...props}
    />
  );
}

export function BubbleContent({
  className = '',
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      data-slot="bubble-content"
      className={`w-fit max-w-full min-w-0 rounded-2xl border border-rose-300/15 bg-rose-500/12 px-3.5 py-2.5 leading-6 wrap-anywhere group-data-[variant=ghost]/bubble:rounded-none group-data-[variant=ghost]/bubble:border-0 group-data-[variant=ghost]/bubble:bg-transparent group-data-[variant=ghost]/bubble:p-0 ${className}`}
      {...props}
    />
  );
}
