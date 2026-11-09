'use client';
import { Input as Primitive } from '@base-ui/react/input';

export const fieldSurface =
  'min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-sm text-ink shadow-[inset_0_1px_0_#ffffff08] transition-[border-color,background-color,box-shadow] duration-200 placeholder:text-zinc-500 hover:border-white/20 focus-visible:border-brand-hot/70 focus-visible:bg-white/[0.05] focus-visible:shadow-[0_0_0_4px_#db143c26] focus-visible:outline-none disabled:opacity-50 data-[invalid]:border-red-400/70';

export function Input({
  className = '',
  ...props
}: Omit<Primitive.Props, 'className'> & { className?: string }) {
  return <Primitive {...props} className={`${fieldSurface} ${className}`} />;
}
