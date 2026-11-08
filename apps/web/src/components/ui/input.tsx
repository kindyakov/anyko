'use client';
import { Input as Primitive } from '@base-ui/react/input';

export function Input({
  className = '',
  ...props
}: Omit<Primitive.Props, 'className'> & { className?: string }) {
  return (
    <Primitive
      {...props}
      className={`border-line bg-surface text-ink placeholder:text-muted focus-visible:outline-brand min-h-11 w-full min-w-0 rounded-lg border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 data-[invalid]:border-red-500 ${className}`}
    />
  );
}
