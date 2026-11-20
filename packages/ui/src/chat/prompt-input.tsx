// shadcn/ui Base Nova Input Group, used by the Prompt Input pattern.
// https://ui.shadcn.com/docs/ai-elements/base/prompt-input · See LICENSE.shadcn.md.
import type { ComponentProps } from 'react';

export function InputGroup({
  className = '',
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={`group/input-group focus-within:border-brand/55 relative flex w-full min-w-0 items-end gap-1 rounded-2xl border border-white/12 bg-white/[0.045] p-1.5 transition-colors ${className}`}
      {...props}
    />
  );
}

export function InputGroupTextarea({
  className = '',
  ...props
}: ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="input-group-control"
      className={`text-ink block field-sizing-content max-h-36 min-h-11 w-full resize-none border-0 bg-transparent px-2.5 py-2.5 text-[15px] leading-6 outline-none placeholder:text-zinc-500 ${className}`}
      {...props}
    />
  );
}
